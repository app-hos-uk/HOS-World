import Link from 'next/link';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from '../lib/constants';

export function LandingFooter() {
  return (
    <footer>
      <div className="f-logo-wrap" role="img" aria-label="House of Spells">
        <img className="f-logo-img" src={LANDING_LOGO} width={60} height={60} alt="" aria-hidden="true" />
        <img className="f-logo-mark" src={LANDING_WORDMARK} width={1024} height={258} alt="" aria-hidden="true" />
      </div>
      <div className="f-urls">
        <a href="https://houseofspells.com/">houseofspells.com</a>
        {' '}&nbsp;·&nbsp;{' '}
        <a href="https://www.houseofspells.co.uk/" target="_blank" rel="noopener noreferrer">
          houseofspells.co.uk
        </a>
        {' '}&nbsp;·&nbsp; Times Square, New York
      </div>
      <div className="f-links">
        <Link href="/">Home</Link>
        <Link href="/universes">Universes</Link>
        <Link href="/the-experience">Experience</Link>
        <Link href={LANDING_REGISTER_PATH}>Register</Link>
        <Link href="/shop">Enter Shop</Link>
        <a href="https://houseofspells.co.uk/policies/privacy-policy" target="_blank" rel="noopener noreferrer">
          Privacy
        </a>
        <a href="https://www.instagram.com/houseofspells/" target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
      </div>
    </footer>
  );
}
