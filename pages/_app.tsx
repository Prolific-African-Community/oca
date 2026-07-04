import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { ToastProvider } from '../components/overlay/Toast';
import { CommandProvider } from '../components/overlay/command';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <CommandProvider>
        <Component {...pageProps} />
      </CommandProvider>
    </ToastProvider>
  );
}
