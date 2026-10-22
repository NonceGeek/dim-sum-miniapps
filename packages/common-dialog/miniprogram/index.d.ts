export interface CommonDialogOptions {
  theme?: "light" | "dark";
  customStyle?: string;
  title: string;
  content: string;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
}

export function showCommonDialog(host: { selectComponent?: (selector: string) => any }, options: CommonDialogOptions): void;
