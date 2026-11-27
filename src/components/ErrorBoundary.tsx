import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isPermissionError: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Unexpected error';
    let friendly = raw;
    let isPermissionError = false;

    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string };
      if (parsed && typeof parsed.error === 'string') {
        friendly = parsed.error;
        if (
          parsed.error.toLowerCase().includes('permission') ||
          parsed.error.toLowerCase().includes('insufficient')
        ) {
          isPermissionError = true;
        }
      }
    } catch {
      if (
        raw.toLowerCase().includes('permission') ||
        raw.toLowerCase().includes('insufficient')
      ) {
        isPermissionError = true;
      }
    }

    return {
      hasError: true,
      errorMessage: friendly,
      isPermissionError,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Dayleaf ErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isVi =
        typeof document !== 'undefined' && document.documentElement.lang === 'vi';

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] p-6 text-[#22201C] dark:bg-[#141311] dark:text-[#EFECE6]">
          <div className="w-full max-w-md rounded-2xl border border-[#E6E0D5] bg-white p-6 shadow-xs dark:border-[#2C2924] dark:bg-[#1D1B18]">
            <div className="flex items-center gap-2.5 text-[#B8413E] dark:text-[#E57B78]">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h1 className="font-display text-lg font-semibold">
                {isVi ? 'Đã xảy ra sự cố kết nối' : 'Something went wrong'}
              </h1>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-[#5F594F] dark:text-[#A9A296]">
              {this.state.isPermissionError
                ? isVi
                  ? 'Không thể đồng bộ dữ liệu đám mây do phiên đăng nhập đã hết hạn hoặc quyền truy cập Supabase chưa hợp lệ. Dữ liệu cục bộ của bạn vẫn an toàn.'
                  : 'Cloud sync encountered a Supabase permission error or an expired session. Your local journal data remains safe.'
                : isVi
                ? 'Ứng dụng gặp lỗi không mong muốn. Bạn hãy tải lại trang để tiếp tục nhé.'
                : 'The app encountered an unexpected error. Please reload the page to continue.'}
            </p>

            {this.state.errorMessage && (
              <p className="mt-3 rounded-xl border border-[#EAE4D9] bg-[#FAF8F4] px-3 py-2 font-mono text-[11px] text-[#7A7367] break-words dark:border-[#2E2B26] dark:bg-[#161512] dark:text-[#968F83]">
                {this.state.errorMessage.slice(0, 240)}
              </p>
            )}

            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3D6B52] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#315843] dark:bg-[#7EB093] dark:text-[#121915] dark:hover:bg-[#91BF9F]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{isVi ? 'Tải lại trang' : 'Reload Page'}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
