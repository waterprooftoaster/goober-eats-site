import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={32}
                height={32}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#A1C935"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25" />
                <path d="M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2" />
                <path d="M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0" />
                {/* <path d="M8 13 L12 16 H15.75 L18 13 Z" fill="#A1C935" stroke="none" /> */}
                <path d="m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2" fill="none" />
            </svg>
        ),
        { ...size }
    )
}
