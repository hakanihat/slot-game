import { el } from '../../core/dom';

export interface ToastOptions {
  readonly tone?: 'info' | 'error';
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly durationMs?: number;
}

/** Non-blocking notifications; errors are announced to screen readers. */
export class Toast {
  readonly element = el('div', { class: 'toasts', 'aria-live': 'assertive' });

  show(message: string, { tone = 'info', action, durationMs = 5000 }: ToastOptions = {}): void {
    const close = () => {
      item.classList.add('toast--leaving');
      setTimeout(() => item.remove(), 250);
    };
    const actionButton = action
      ? el('button', { type: 'button', class: 'toast__action', text: action.label })
      : null;
    actionButton?.addEventListener('click', () => {
      action?.onClick();
      close();
    });
    const item = el(
      'div',
      { class: `toast toast--${tone}`, role: tone === 'error' ? 'alert' : 'status' },
      [el('span', { text: message }), actionButton],
    );
    this.element.append(item);
    setTimeout(close, durationMs);
  }
}
