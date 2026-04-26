import type { SVGProps } from 'react'

export default function PhoneCart(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" fill="#1f2022" />
            <path d="M12 18h.01" stroke="white" />
            <g transform="translate(6, 4) scale(0.15)" strokeWidth={2}>
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </g>
        </svg>
    )
}