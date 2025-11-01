import React from 'react';
import {render} from '@testing-library/react';
import {it, expect, describe} from 'vitest';
import {RichTextField} from '.';

describe('RichTextField', () => {
  it('renders some markdown', () => {
    const content = 'Hello __World__';
    const {container} = render(<RichTextField content={content} />);
    expect(container.innerHTML).toContain('<strong>World</strong>');
  });

  it('does not allow unsafe content', () => {
    const content = 'Hello <script>alert("World")</script>';
    const {container} = render(<RichTextField content={content} />);
    expect(container.innerHTML).not.toContain('<script>alert("World")</script>');
  });

  it('renders nothing when content is empty', () => {
    const {container} = render(<RichTextField content="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when content is only whitespace', () => {
    const {container} = render(<RichTextField content="   " />);
    expect(container.innerHTML).toBe('');
  });
});
