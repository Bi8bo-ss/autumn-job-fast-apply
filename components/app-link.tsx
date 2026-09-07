'use client';

import type { ComponentPropsWithoutRef, MouseEvent } from 'react';

type AppLinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: string;
};

/**
 * Vinext's production router currently intercepts internal links without
 * completing the navigation. Keep a real href for progressive enhancement,
 * then force a document navigation for ordinary primary-button clicks.
 */
export function AppLink({ children, href, onClickCapture, target, ...props }: AppLinkProps) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    const preventedBeforeConsumerHandler = event.defaultPrevented;
    onClickCapture?.(event);
    if (
      (!preventedBeforeConsumerHandler && event.defaultPrevented) ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== '_self')
    ) return;

    event.preventDefault();
    event.stopPropagation();
    window.location.assign(event.currentTarget.href);
  }

  return <a {...props} href={href} target={target} onClickCapture={navigate}>{children}</a>;
}
