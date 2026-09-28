import { el } from '../../core/dom';
import { Icons, iconButton } from '../icons';

/**
 * Thin wrapper over the native <dialog>: focus trapping, Esc-to-close and
 * the backdrop come for free and are accessible by default.
 */
export class Modal {
  readonly dialog: HTMLDialogElement;
  readonly body: HTMLElement;

  constructor(title: string, className = '') {
    const closeButton = iconButton(Icons.close, 'Close');
    closeButton.addEventListener('click', () => this.close());
    const titleId = `modal-${title.toLowerCase().replace(/\W+/g, '-')}`;
    this.body = el('div', { class: 'modal__body' });
    this.dialog = el('dialog', { class: `modal ${className}`, 'aria-labelledby': titleId }, [
      el('header', { class: 'modal__header' }, [
        el('h2', { id: titleId, text: title }),
        closeButton,
      ]),
      this.body,
    ]);
    // Clicking the backdrop (the dialog element itself) closes it.
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.close();
    });
    document.body.append(this.dialog);
  }

  open(): void {
    if (!this.dialog.open) this.dialog.showModal();
  }

  close(): void {
    if (this.dialog.open) this.dialog.close();
  }
}
