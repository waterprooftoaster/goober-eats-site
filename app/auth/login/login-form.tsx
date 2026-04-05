'use client'

import { useActionState, useEffect, useState } from 'react'
import { authenticate, completeOnboarding } from '@/app/auth/actions'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface School {
  id: string
  name: string
}

export function LoginForm({
  callbackError,
  schools,
  initialOnboarding,
  userEmail,
}: {
  callbackError?: string
  schools: School[]
  initialOnboarding?: boolean
  userEmail?: string
}) {
  const [step, setStep] = useState<'email' | 'password' | 'name' | 'school'>(
    initialOnboarding ? 'name' : 'email',
  )
  const [email, setEmail] = useState(userEmail ?? '')
  const [emailError, setEmailError] = useState('')
  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [fullName, setFullName] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<{ value: string; label: string } | null>(null)
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('')

  const [authState, formAction, authPending] = useActionState(authenticate, null)
  const [onboardingState, onboardingAction, onboardingPending] = useActionState(
    completeOnboarding,
    null,
  )

  // Transition to onboarding when authenticate signals it
  useEffect(() => {
    if (authState && 'needsOnboarding' in authState) {
      setEmail(authState.email)
      setStep('name')
    }
  }, [authState])

  const inputStyle =
    'block w-full h-12 rounded-md border border-gray-300 px-3 py-2 text-base focus:border-black focus:outline-none focus:ring-1 focus:ring-black'

  const headingStyle = 'text-4xl font-bold text-gray-900 mb-6'

  async function handleContinue() {
    if (!email || !EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    setEmailError('')
    setCheckingEmail(true)

    try {
      const res = await fetch(
        '/api/auth/check-email?email=' + encodeURIComponent(email),
      )
      const body = await res.json()
      setEmailExists(body.exists ?? false)
    } catch {
      // Default to sign-up mode on network error
      setEmailExists(false)
    }

    setCheckingEmail(false)
    setStep('password')
  }

  const error =
    (authState && 'error' in authState ? authState.error : null) ?? callbackError

  return (
    <main className="fixed inset-0 z-10 flex items-center justify-center bg-white">
      <div className="w-full max-w-sm space-y-4 p-8">
        {step === 'email' && (
          <>
            {callbackError && (
              <p className="text-sm text-red-600 text-center">{callbackError}</p>
            )}

            <h1 className={headingStyle}>Enter your email</h1>

            <div>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleContinue()
                  }
                }}
                className={inputStyle}
              />
              {emailError && (
                <p className="mt-1 text-sm text-red-600">{emailError}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={checkingEmail}
              className="w-full h-12 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {checkingEmail ? '...' : 'Continue'}
            </button>
          </>
        )}

        {step === 'password' && (
          <>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <button
              type="button"
              onClick={() => setStep('email')}
              className="text-sm text-gray-500 hover:text-black"
            >
              &larr; Back
            </button>

            <h1 className={headingStyle}>Enter your password</h1>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="email" value={email} />

              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                minLength={6}
                className={inputStyle}
              />

              {emailExists === false && (
                <>
                  <p className={headingStyle}>Confirm your password</p>
                  <input
                    name="confirm_password"
                    type="password"
                    placeholder="Confirm Password"
                    required
                    minLength={6}
                    className={inputStyle}
                  />
                </>
              )}

              <button
                type="submit"
                disabled={authPending}
                className="w-full h-12 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {authPending
                  ? '...'
                  : emailExists
                    ? 'Sign In'
                    : 'Sign Up'}
              </button>
            </form>
          </>
        )}

        {step === 'name' && (
          <>
            <h1 className={headingStyle}>What should we call you?</h1>

            <input
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              className={inputStyle}
            />

            <button
              type="button"
              onClick={() => setStep('school')}
              disabled={!fullName.trim()}
              className="w-full h-12 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Continue
            </button>
          </>
        )}

        {step === 'school' && (
          <>
            {onboardingState && 'error' in onboardingState && (
              <p className="text-sm text-red-600 text-center">
                {onboardingState.error}
              </p>
            )}

            <button
              type="button"
              onClick={() => setStep('name')}
              className="text-sm text-gray-500 hover:text-black"
            >
              &larr; Back
            </button>

            <h1 className={headingStyle}>What school do you go to?</h1>

            <form action={onboardingAction} className="space-y-6">
              <input type="hidden" name="full_name" value={fullName} />

              <Combobox
                value={selectedSchool}
                onValueChange={(value) =>
                  setSelectedSchool(value as { value: string; label: string } | null)
                }
                onInputValueChange={(inputValue) =>
                  setSchoolSearchQuery(inputValue)
                }
                isItemEqualToValue={(a, b) => a.value === b.value}
                autoHighlight
              >
                <ComboboxInput
                  placeholder="Search schools..."
                  className="h-12 rounded-md border-gray-300 text-base focus:border-black focus:ring-1 focus:ring-black"
                />
                <ComboboxContent>
                  <ComboboxList>
                    {schools.map((school) => (
                      <ComboboxItem
                        key={school.id}
                        value={{ value: school.id, label: school.name }}
                        className="py-3 text-base"
                      >
                        {school.name}
                      </ComboboxItem>
                    ))}
                    {schoolSearchQuery.trim().length > 0 && (
                      <ComboboxEmpty>No schools found</ComboboxEmpty>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <input type="hidden" name="school_id" value={selectedSchool?.value ?? ''} />

              <button
                type="submit"
                disabled={onboardingPending || !selectedSchool}
                className="w-full h-12 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {onboardingPending ? '...' : 'Get Started'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
