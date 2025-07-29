import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SyncButton } from '../components/SyncButton';
import { SyncService, SyncStatus, SyncResult } from '../services/SyncService';
import { AuthService } from '../services/AuthService';

// Mock dependencies
jest.mock('../services/SyncService');
jest.mock('../services/AuthService');
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  Alert: {
    alert: jest.fn(),
  },
}));

describe('SyncButton', () => {
  let mockSyncService: jest.Mocked<SyncService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAlert: jest.MockedFunction<typeof Alert.alert>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    encryptionKey: 'test-key',
  };

  const mockSyncStatus: SyncStatus = {
    isOnline: true,
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 2,
  };

  const mockSyncResult: SyncResult = {
    success: true,
    syncedCount: 2,
    failedCount: 0,
    errors: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SyncService
    mockSyncService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getSyncStatus: jest.fn().mockResolvedValue(mockSyncStatus),
      syncHealthLogs: jest.fn().mockResolvedValue(mockSyncResult),
      authenticateWithSupabase: jest.fn().mockResolvedValue(undefined),
      retrySyncWithBackoff: jest.fn().mockResolvedValue(mockSyncResult),
    } as any;

    // Mock AuthService
    mockAuthService = {
      getCurrentUser: jest.fn().mockResolvedValue(mockUser),
    } as any;

    // Mock static getInstance methods
    (SyncService.getInstance as jest.Mock).mockReturnValue(mockSyncService);
    (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);

    // Mock Alert
    mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;
  });

  describe('Initialization', () => {
    it('should initialize sync service on mount', async () => {
      render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(mockSyncService.initialize).toHaveBeenCalled();
      });
    });

    it('should show initializing state before initialization', () => {
      const { getByText } = render(<SyncButton userId={1} />);
      
      expect(getByText('Initializing...')).toBeTruthy();
    });

    it('should handle initialization failure', async () => {
      const mockOnSyncError = jest.fn();
      mockSyncService.initialize.mockRejectedValue(new Error('Init failed'));

      render(<SyncButton userId={1} onSyncError={mockOnSyncError} />);

      await waitFor(() => {
        expect(mockOnSyncError).toHaveBeenCalledWith('Failed to initialize sync service');
      });
    });
  });

  describe('Sync Status Display', () => {
    it('should display correct button text for pending sync', async () => {
      const { getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByText('Sync Now (2)')).toBeTruthy();
      });
    });

    it('should display offline status when not connected', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        isOnline: false,
      });

      const { getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByText('Offline')).toBeTruthy();
      });
    });

    it('should display all synced status when no pending logs', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        pendingCount: 0,
      });

      const { getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByText('All Synced')).toBeTruthy();
      });
    });

    it('should display syncing status during sync', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        isSyncing: true,
      });

      const { getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByText('Syncing...')).toBeTruthy();
      });
    });
  });

  describe('Sync Button Interactions', () => {
    it('should perform successful sync when button is pressed', async () => {
      const mockOnSyncComplete = jest.fn();
      const { getByTestId } = render(
        <SyncButton userId={1} onSyncComplete={mockOnSyncComplete} />
      );

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      await waitFor(() => {
        expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
        expect(mockSyncService.authenticateWithSupabase).toHaveBeenCalledWith(
          mockUser.email,
          'demo-password'
        );
        expect(mockSyncService.syncHealthLogs).toHaveBeenCalledWith(1);
        expect(mockOnSyncComplete).toHaveBeenCalledWith(mockSyncResult);
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Sync Complete',
        'Successfully synced 2 health logs to the cloud.',
        [{ text: 'OK' }]
      );
    });

    it('should show offline alert when trying to sync offline', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        isOnline: false,
      });

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'No Internet Connection',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    });

    it('should show nothing to sync alert when no pending logs', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        pendingCount: 0,
      });

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Nothing to Sync',
        'All your health logs are already synced to the cloud.',
        [{ text: 'OK' }]
      );
    });

    it('should handle sync error with retry option', async () => {
      const mockOnSyncError = jest.fn();
      mockSyncService.syncHealthLogs.mockRejectedValue(new Error('Network timeout'));

      const { getByTestId } = render(
        <SyncButton userId={1} onSyncError={mockOnSyncError} />
      );

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      await waitFor(() => {
        expect(mockOnSyncError).toHaveBeenCalledWith('Network timeout');
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Sync Failed',
        'Failed to sync health logs: Network timeout',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: expect.any(Function) },
        ]
      );
    });

    it('should handle partial sync success', async () => {
      const partialResult: SyncResult = {
        success: true,
        syncedCount: 1,
        failedCount: 1,
        errors: [{ localId: 2, error: 'Upload failed', retryable: true }],
      };

      mockSyncService.syncHealthLogs.mockResolvedValue(partialResult);

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Partial Sync Complete',
          'Successfully synced 1 health log to the cloud.\n\n1 log failed to sync and will be retried later.',
          [{ text: 'OK' }]
        );
      });
    });

    it('should handle authentication failure', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Sync Failed',
          'Failed to sync health logs: User not authenticated',
          expect.any(Array)
        );
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should perform retry with backoff when retry button is pressed', async () => {
      mockSyncService.syncHealthLogs.mockRejectedValue(new Error('Network error'));

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      // Trigger initial sync failure
      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      // Get the retry function from the alert call
      const alertCalls = mockAlert.mock.calls;
      const retryCall = alertCalls.find(call => call[0] === 'Sync Failed');
      const retryButton = retryCall?.[2]?.find((button: any) => button.text === 'Retry');

      expect(retryButton).toBeTruthy();

      // Execute retry
      if (retryButton && typeof retryButton.onPress === 'function') {
        await act(async () => {
          (retryButton as any).onPress();
        });
      }

      await waitFor(() => {
        expect(mockSyncService.retrySyncWithBackoff).toHaveBeenCalledWith(1, 3);
      });

      expect(mockAlert).toHaveBeenCalledWith(
        'Retry Complete',
        'Successfully synced 2 health logs.',
        [{ text: 'OK' }]
      );
    });

    it('should handle retry failure', async () => {
      mockSyncService.syncHealthLogs.mockRejectedValue(new Error('Network error'));
      mockSyncService.retrySyncWithBackoff.mockRejectedValue(new Error('Retry failed'));

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      // Trigger initial sync failure
      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      // Get and execute retry
      const alertCalls = mockAlert.mock.calls;
      const retryCall = alertCalls.find(call => call[0] === 'Sync Failed');
      const retryButton = retryCall?.[2]?.find((button: any) => button.text === 'Retry');

      if (retryButton && typeof retryButton.onPress === 'function') {
        await act(async () => {
          (retryButton as any).onPress();
        });
      }

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Retry Failed',
          'Failed to retry sync: Retry failed',
          [{ text: 'OK' }]
        );
      });
    });
  });

  describe('Status Messages', () => {
    it('should show success status message after successful sync', async () => {
      const { getByTestId, getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      await waitFor(() => {
        expect(getByText('Sync Successful')).toBeTruthy();
        expect(getByText('2 logs synced')).toBeTruthy();
      });
    });

    it('should show error status message after failed sync', async () => {
      mockSyncService.syncHealthLogs.mockRejectedValue(new Error('Network timeout'));

      const { getByTestId, getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      await waitFor(() => {
        expect(getByText('Sync Failed')).toBeTruthy();
        expect(getByText('Network timeout')).toBeTruthy();
      });
    });

    it('should hide status message after timeout', async () => {
      jest.useFakeTimers();

      const { getByTestId, getByText, queryByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByTestId('sync-button')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      await waitFor(() => {
        expect(getByText('Sync Successful')).toBeTruthy();
      });

      // Fast forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(queryByText('Sync Successful')).toBeNull();
      });

      jest.useRealTimers();
    });
  });

  describe('Sync Statistics', () => {
    it('should display sync statistics', async () => {
      const { getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByText('Status: Online')).toBeTruthy();
        expect(getByText('Pending: 2')).toBeTruthy();
      });
    });

    it('should update statistics when offline', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        isOnline: false,
        pendingCount: 5,
      });

      const { getByText } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(getByText('Status: Offline')).toBeTruthy();
        expect(getByText('Pending: 5')).toBeTruthy();
      });
    });
  });

  describe('Button States', () => {
    it('should disable button when offline', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        isOnline: false,
      });

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        const button = getByTestId('sync-button');
        expect(button.props.accessibilityState.disabled).toBe(true);
      });
    });

    it('should disable button when syncing', async () => {
      mockSyncService.getSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        isSyncing: true,
      });

      const { getByTestId } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        const button = getByTestId('sync-button');
        expect(button.props.accessibilityState.disabled).toBe(true);
      });
    });

    it('should disable button when not initialized', () => {
      mockSyncService.initialize.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { getByTestId } = render(<SyncButton userId={1} />);

      const button = getByTestId('sync-button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('Status Updates', () => {
    it('should update status periodically', async () => {
      jest.useFakeTimers();

      render(<SyncButton userId={1} />);

      // Initial call
      await waitFor(() => {
        expect(mockSyncService.getSyncStatus).toHaveBeenCalledTimes(1);
      });

      // Fast forward 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(mockSyncService.getSyncStatus).toHaveBeenCalledTimes(2);
      });

      jest.useRealTimers();
    });

    it('should clean up interval on unmount', async () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = render(<SyncButton userId={1} />);

      await waitFor(() => {
        expect(mockSyncService.getSyncStatus).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});