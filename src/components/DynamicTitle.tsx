'use client';

import { useEffect } from 'react';

export function DynamicTitle() {
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.siteTitle) {
          document.title = data.siteTitle;
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
