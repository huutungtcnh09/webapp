import { createElement } from 'react'
import './styles.css'

export function Card({ children, className = '' }) {
  return createElement('div', { className: `ui-card ${className}`.trim() }, children)
}

export function PrimaryButton({ children, className = '', ...props }) {
  return createElement(
    'button',
    {
      className: `ui-button-primary ${className}`.trim(),
      ...props,
    },
    children,
  )
}
