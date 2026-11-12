import {$, browser} from '@wdio/globals';

const NEXT_PAGE_BUTTON = '//button[.//span[text()="Go to next page"]]';

/** An XPath string literal for `text`, whatever quotes it contains. */
function xpathLiteral(text: string): string {
  if (!text.includes("'")) {
    return `'${text}'`;
  }
  if (!text.includes('"')) {
    return `"${text}"`;
  }
  return `concat(${text
    .split("'")
    .map(part => `'${part}'`)
    .join(', "\'", ')})`;
}

/**
 * Find the first data-table row whose text contains `text`.
 *
 * Control Centre tables show one server page at a time and have no search
 * box, so the row may not be on the page that loads first. While the row is
 * not on the current page this presses Next; it fails once the last page has
 * been read (or `timeout` passes) without a match.
 */
export async function findTableRow(
  text: string,
  options: {timeout?: number} = {}
) {
  const timeout = options.timeout ?? 20000;
  const rowSelector = `//tbody/tr[contains(., ${xpathLiteral(text)})]`;
  let pagesRead = 1;

  await browser.waitUntil(
    async () => {
      if (await $(rowSelector).isExisting()) {
        return true;
      }
      // Next is disabled while a page is loading and on the last page, so
      // this only moves on once the current page has been read in full.
      const next = $(NEXT_PAGE_BUTTON);
      if ((await next.isExisting()) && (await next.isEnabled())) {
        await next.click();
        pagesRead += 1;
      }
      return false;
    },
    {
      timeout,
      interval: 250,
      timeoutMsg: `Expected a table row containing "${text}" (read ${pagesRead} page(s))`,
    }
  );
  return $(rowSelector);
}
