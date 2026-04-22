/**
 * @file screenshot-uploader.test.tsx
 * @description Unit tests for ScreenshotUploader component.
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UploadFile } from '@/lib/types/upload'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={(props.alt as string) ?? ''} />
  },
}))

// Import after mocks
const { ScreenshotUploader } = await import('@/components/order/screenshot-uploader')

function makeFile(name = 'photo.jpg', type = 'image/jpeg', size = 1024): File {
  const file = new File(['x'.repeat(size)], name, { type })
  return file
}

function makeUploadFile(overrides: Partial<UploadFile> = {}): UploadFile {
  return {
    key: crypto.randomUUID(),
    file: makeFile(),
    status: 'idle',
    url: null,
    error: null,
    ...overrides,
  }
}

describe('ScreenshotUploader', () => {
  it('renders the upload trigger button with ImageUp icon', () => {
    render(<ScreenshotUploader files={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /upload screenshots/i })).toBeInTheDocument()
  })

  it('calls onChange with new file appended on valid file selection', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ScreenshotUploader files={[]} onChange={onChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('cart.jpg', 'image/jpeg')
    await user.upload(input, file)
    expect(onChange).toHaveBeenCalledOnce()
    const [newFiles] = onChange.mock.calls[0]
    expect(newFiles).toHaveLength(1)
    expect(newFiles[0].status).toBe('idle')
    expect(newFiles[0].file).toBe(file)
  })

  it('rejects a file larger than 10 MB with an error status', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ScreenshotUploader files={[]} onChange={onChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)
    await user.upload(input, bigFile)
    expect(onChange).toHaveBeenCalledOnce()
    const [newFiles] = onChange.mock.calls[0]
    expect(newFiles[0].status).toBe('error')
    expect(newFiles[0].error).toMatch(/10\s*MB/i)
  })

  it('rejects a disallowed MIME type with an error status', () => {
    const onChange = vi.fn()
    render(<ScreenshotUploader files={[]} onChange={onChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const gifFile = makeFile('anim.gif', 'image/gif')
    // userEvent.upload respects the `accept` attribute and silently filters non-matching files.
    // Use fireEvent.change to bypass that filter and test the component's own MIME validation.
    Object.defineProperty(input, 'files', {
      value: { 0: gifFile, length: 1, item: () => gifFile },
      configurable: true,
    })
    fireEvent.change(input)
    expect(onChange).toHaveBeenCalledOnce()
    const [newFiles] = onChange.mock.calls[0]
    expect(newFiles[0].status).toBe('error')
    expect(newFiles[0].error).toMatch(/not supported|invalid|type/i)
  })

  it('disables the input when 5 files are already loaded', () => {
    const files = Array.from({ length: 5 }, () => makeUploadFile())
    render(<ScreenshotUploader files={files} onChange={vi.fn()} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('shows a spinner for uploading files', () => {
    const files = [makeUploadFile({ status: 'uploading' })]
    render(<ScreenshotUploader files={files} onChange={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a thumbnail image for done files', () => {
    const files = [makeUploadFile({ status: 'done', url: 'https://example.com/img.jpg' })]
    render(<ScreenshotUploader files={files} onChange={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.jpg')
  })

  it('shows the error message for error-status files', () => {
    const files = [makeUploadFile({ status: 'error', error: 'File too large' })]
    render(<ScreenshotUploader files={files} onChange={vi.fn()} />)
    expect(screen.getByText('File too large')).toBeInTheDocument()
  })

  it('calls onChange with file removed when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const files = [makeUploadFile({ status: 'idle' })]
    render(<ScreenshotUploader files={files} onChange={onChange} />)
    const removeBtn = screen.getByRole('button', { name: /remove screenshot 1/i })
    await user.click(removeBtn)
    expect(onChange).toHaveBeenCalledWith([])
  })
})
