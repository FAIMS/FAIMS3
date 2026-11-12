// SPDX-License-Identifier: Apache-2.0
import '@testing-library/jest-dom/vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ImageWithFallback} from './ImageWithFallback';

describe('ImageWithFallback', () => {
  it('renders the image until it fails to load', () => {
    render(
      <ImageWithFallback
        src="blob:ok"
        alt="photo"
        sx={{width: 10, height: 10}}
      />
    );
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'blob:ok');
    expect(img).toHaveAttribute('alt', 'photo');
    expect(screen.queryByTestId('broken-image-thumbnail')).toBeNull();
  });

  it('swaps to a placeholder when the image cannot be decoded', () => {
    render(<ImageWithFallback src="blob:broken" alt="photo" />);
    fireEvent.error(document.querySelector('img') as HTMLImageElement);

    expect(screen.getByTestId('broken-image-thumbnail')).toBeInTheDocument();
    expect(screen.getByText('Image preview not available')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('hides the caption when fallbackLabel is empty', () => {
    render(
      <ImageWithFallback src="blob:broken" alt="photo" fallbackLabel="" />
    );
    fireEvent.error(document.querySelector('img') as HTMLImageElement);

    expect(screen.getByTestId('broken-image-thumbnail')).toBeInTheDocument();
    expect(screen.queryByText('Image preview not available')).toBeNull();
  });
});

