/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.

/**
 * Security Features:
 * 1. HTML Sanitization using DOMPurify
 * 2. Strict tag and attribute whitelisting
 * 3. Protocol validation for links
 * 4. Domain validation for images
 * 5. Forced security attributes for external links
 */

import type {Config} from 'dompurify';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

// Configure markdown-it with minimal HTML support
// html: true is required for img tags to work, but all HTML is sanitized before rendering
// typographer: true enables smart quotes and other typographic features
const md = new MarkdownIt({
  html: true,
  typographer: true,
});

/**
 * Validates URLs to ensure they use safe protocols.
 * This prevents javascript: URLs and other potentially malicious protocols.
 * Allows base 64 images
 *
 * @param url - The URL to validate
 * @returns boolean - Whether the URL uses an allowed protocol
 */
md.validateLink = (url: string) => {
  const protocols = ['http:', 'https:', 'mailto:', 'tel:', 'data:'];
  try {
    const urlObj = new URL(url);
    return protocols.includes(urlObj.protocol);
  } catch {
    // Special handling for data URLs which might not parse as URLs
    if (url.startsWith('data:image/')) {
      return true;
    }
    return false;
  }
};

/**
 * DOMPurify configuration
 * Implements a strict security policy for HTML sanitization
 */
const purifyConfig: Config = {
  // Explicitly whitelist allowed HTML tags
  // Any tags not in this list will be stripped from the output
  ALLOWED_TAGS: [
    // Text formatting - Basic typography and code display
    'p',
    'br',
    'b',
    'i',
    'em',
    'strong',
    'code',
    'pre',

    // Structure - Basic document structure elements
    'div',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',

    // Lists - Ordered and unordered lists
    'ul',
    'ol',
    'li',

    // Media - Only images are allowed
    'img',

    // Links - External links with forced security attributes
    'a',
  ],

  // Explicitly whitelist allowed attributes
  // Any attributes not in this list will be stripped
  ALLOWED_ATTR: [
    'id',
    'class',
    'src',
    'alt',
    'title',
    'href',
    'target',
    'rel',
    'width',
    'height',
    'style',
  ],

  // Disable data attributes to prevent potential DOM-based XSS
  ALLOW_DATA_ATTR: false,

  // Enable DOM sanitization
  SANITIZE_DOM: true,

  // Don't treat input as a complete HTML document
  WHOLE_DOCUMENT: false,
};

/**
 * Hook to create a configured instance of DOMPurify
 */
const createSanitizer = () => {
  const purify = DOMPurify(window);

  purify.addHook('afterSanitizeAttributes', node => {
    // Handle links
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    }

    // Handle images
    if (node.tagName === 'IMG' && node.hasAttribute('src')) {
      const src = node.getAttribute('src') || '';

      // Handle data URLs for images
      if (src.startsWith('data:image/')) {
        // Validate data URL format
        const isValidDataUrl =
          /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);base64,([a-zA-Z0-9+/]+={0,2})$/.test(
            src
          );

        if (!isValidDataUrl) {
          node.removeAttribute('src');
        }
        // Data URL is valid, allow it to remain
        return;
      }

      // Handle regular URLs
      try {
        const url = new URL(src);
        const trustedDomains = ['yourdomain.com', 'cdn.yourdomain.com'];
        if (!trustedDomains.some(domain => url.hostname.endsWith(domain))) {
          node.removeAttribute('src');
        }
      } catch {
        node.removeAttribute('src');
      }
    }
  });

  return purify;
};

// Get a configured DOMPurify instance
const purify = createSanitizer();

/**
 * Takes markdown content with HTML and produces a sanitized HTML string
 * @param content
 * @returns Sanitized content suitable for injection into div
 */
export const contentToSanitizedHtml = (content: string): string => {
  try {
    const renderedContent = md.render(content);
    const sanitizedContent = purify.sanitize(renderedContent, purifyConfig);
    return sanitizedContent;
  } catch (e) {
    console.error('Could not sanitize/parse content string. Error: ', e);
    return 'Error';
  }
};
