import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/TestUtils';
import { ChatContextProvider } from '../ChatContextProvider';

// Mock the context providers
vi.mock('@/contexts/ApprovalFeedbackContext', () => ({
  ApprovalFeedbackProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="approval-feedback-provider">{children}</div>
  ),
}));

vi.mock('@/contexts/EntriesContext', () => ({
  EntriesProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="entries-provider">{children}</div>
  ),
}));

vi.mock('@/contexts/MessageEditContext', () => ({
  MessageEditProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="message-edit-provider">{children}</div>
  ),
}));

vi.mock('@/contexts/RetryUiContext', () => ({
  RetryUiProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="retry-ui-provider">{children}</div>
  ),
}));

describe('ChatContextProvider', () => {
  it('renders children with all providers', () => {
    render(
      <ChatContextProvider attemptId="test-attempt-id">
        <div data-testid="child-content">Test Content</div>
      </ChatContextProvider>
    );

    // Verify child content is rendered
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('wraps children in the correct provider hierarchy', () => {
    render(
      <ChatContextProvider
        attemptId="test-attempt-id"
        sessionId="test-session-id"
      >
        <div data-testid="child-content">Test Content</div>
      </ChatContextProvider>
    );

    // Verify all providers are rendered in the correct order
    expect(
      screen.getByTestId('approval-feedback-provider')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entries-provider')).toBeInTheDocument();
    expect(screen.getByTestId('message-edit-provider')).toBeInTheDocument();
    expect(screen.getByTestId('retry-ui-provider')).toBeInTheDocument();
  });
});
