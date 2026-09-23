import Image from 'next/image';
import styles from './landing-next.module.css';

// The square mark in two tones: the default transparent logo is nearly white and
// disappears on the light (catppuccin) marketing theme, so light mode gets the
// darker `-light` file instead. Both render and CSS picks one, keyed off the
// `data-theme` attribute the root layout sets before first paint, so there is
// no flash of the wrong logo and no client JavaScript.
export default function ThemedLogo({
  size,
  alt = '',
  className = '',
}: {
  size: number;
  alt?: string;
  className?: string;
}) {
  return (
    <>
      <Image
        src="/logo-square-transparent.png"
        alt={alt}
        width={size}
        height={size}
        className={`${styles.logoOnDark} ${className}`}
      />
      <Image
        src="/logo-square-transparent-light.png"
        alt={alt}
        width={size}
        height={size}
        className={`${styles.logoOnLight} ${className}`}
      />
    </>
  );
}
