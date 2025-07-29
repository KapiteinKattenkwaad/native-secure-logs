import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HealthLogDetail } from '../components/HealthLogDetail';
import { HealthLog } from '../types';

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockOnEdit = jest.fn();
const mockOnDelete = jest.fn();
const mockOnClose = jest.fn();

const mockHealthLog: HealthLog = {
  id: 'test-id-123',
  title: 'Severe Headache',
  description: 'Experienced a severe headache that lasted for several hours. Started after lunch and gradually got worse throughout the afternoon.',
  category: 'symptom',
  severity: 4,
  tags: ['headache', 'severe', 'afternoon'],
  date: '2024-01-15T14:30:00.000Z',
  notes: 'Took ibuprofen at 3 PM. Pain subsided after 2 hours. Should monitor if this becomes a pattern.',
  attachments: ['photo1.jpg', 'medical_report.pdf'],
};

const mockHealthLogMinimal: HealthLog = {
  id: 'minimal-id',
  title: 'Basic Log',
  description: 'Simple description',
  category: 'other',
  tags: [],
  date: '2024-01-15T10:00:00.000Z',
};

describe('HealthLogDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders health log details correctly', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Severe Headache')).toBeTruthy();
    expect(getByText('Monday, January 15, 2024')).toBeTruthy();
    expect(getByText('symptom')).toBeTruthy();
    expect(getByText('Severity 4 - Severe')).toBeTruthy();
    expect(getByText('Description')).toBeTruthy();
    expect(getByText(mockHealthLog.description)).toBeTruthy();
  });

  it('displays tags correctly', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Tags')).toBeTruthy();
    expect(getByText('#headache')).toBeTruthy();
    expect(getByText('#severe')).toBeTruthy();
    expect(getByText('#afternoon')).toBeTruthy();
  });

  it('displays notes when present', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Notes')).toBeTruthy();
    expect(getByText(mockHealthLog.notes!)).toBeTruthy();
  });

  it('displays attachments when present', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Attachments')).toBeTruthy();
    expect(getByText('photo1.jpg')).toBeTruthy();
    expect(getByText('medical_report.pdf')).toBeTruthy();
  });

  it('hides optional sections when data is not present', () => {
    const { queryByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLogMinimal}
        onClose={mockOnClose}
      />
    );

    expect(queryByText('Severity')).toBeFalsy();
    expect(queryByText('Tags')).toBeFalsy();
    expect(queryByText('Notes')).toBeFalsy();
    expect(queryByText('Attachments')).toBeFalsy();
  });

  it('displays health log ID in metadata section', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Health Log ID')).toBeTruthy();
    expect(getByText('test-id-123')).toBeTruthy();
  });

  it('calls onClose when back button is pressed', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(getByText('← Back'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows action buttons when showActions is true', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        showActions={true}
      />
    );

    expect(getByText('Edit')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
  });

  it('hides action buttons when showActions is false', () => {
    const { queryByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
        showActions={false}
      />
    );

    expect(queryByText('Edit')).toBeFalsy();
    expect(queryByText('Delete')).toBeFalsy();
  });

  it('calls onEdit when edit button is pressed', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onEdit={mockOnEdit}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalled();
  });

  it('shows delete confirmation when delete button is pressed', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(getByText('Delete'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Health Log',
      'Are you sure you want to delete this health log? This action cannot be undone.',
      expect.arrayContaining([
        { text: 'Cancel', style: 'cancel' },
        expect.objectContaining({
          text: 'Delete',
          style: 'destructive',
        }),
      ])
    );
  });

  it('calls onDelete when deletion is confirmed', async () => {
    // Mock Alert.alert to automatically confirm deletion
    (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
      const deleteButton = buttons?.find((button: any) => button.text === 'Delete');
      if (deleteButton && deleteButton.onPress) {
        deleteButton.onPress();
      }
    });

    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(getByText('Delete'));

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalled();
    });
  });

  it('handles delete errors gracefully', async () => {
    mockOnDelete.mockRejectedValueOnce(new Error('Delete failed'));

    // Mock Alert.alert to automatically confirm deletion
    (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
      const deleteButton = buttons?.find((button: any) => button.text === 'Delete');
      if (deleteButton && deleteButton.onPress) {
        deleteButton.onPress();
      }
    });

    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    fireEvent.press(getByText('Delete'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to delete health log');
    });
  });

  it('displays correct severity labels', () => {
    const severityTests = [
      { severity: 1, label: 'Severity 1 - Very Mild' },
      { severity: 2, label: 'Severity 2 - Mild' },
      { severity: 3, label: 'Severity 3 - Moderate' },
      { severity: 4, label: 'Severity 4 - Severe' },
      { severity: 5, label: 'Severity 5 - Very Severe' },
    ];

    severityTests.forEach(({ severity, label }) => {
      const { getByText, unmount } = render(
        <HealthLogDetail
          healthLog={{ ...mockHealthLog, severity: severity as any }}
          onClose={mockOnClose}
        />
      );

      expect(getByText(label)).toBeTruthy();
      unmount();
    });
  });

  it('displays correct category colors and labels', () => {
    const categories = ['symptom', 'medication', 'appointment', 'measurement', 'other'] as const;

    categories.forEach((category) => {
      const { getByText, unmount } = render(
        <HealthLogDetail
          healthLog={{ ...mockHealthLog, category }}
          onClose={mockOnClose}
        />
      );

      expect(getByText(category)).toBeTruthy();
      unmount();
    });
  });

  it('handles empty notes gracefully', () => {
    const logWithEmptyNotes = { ...mockHealthLog, notes: '   ' };
    const { queryByText } = render(
      <HealthLogDetail
        healthLog={logWithEmptyNotes}
        onClose={mockOnClose}
      />
    );

    expect(queryByText('Notes')).toBeFalsy();
  });

  it('handles undefined notes gracefully', () => {
    const logWithoutNotes = { ...mockHealthLog, notes: undefined };
    const { queryByText } = render(
      <HealthLogDetail
        healthLog={logWithoutNotes}
        onClose={mockOnClose}
      />
    );

    expect(queryByText('Notes')).toBeFalsy();
  });

  it('handles empty attachments array', () => {
    const logWithoutAttachments = { ...mockHealthLog, attachments: [] };
    const { queryByText } = render(
      <HealthLogDetail
        healthLog={logWithoutAttachments}
        onClose={mockOnClose}
      />
    );

    expect(queryByText('Attachments')).toBeFalsy();
  });

  it('handles undefined attachments', () => {
    const logWithoutAttachments = { ...mockHealthLog, attachments: undefined };
    const { queryByText } = render(
      <HealthLogDetail
        healthLog={logWithoutAttachments}
        onClose={mockOnClose}
      />
    );

    expect(queryByText('Attachments')).toBeFalsy();
  });

  it('formats date correctly', () => {
    const { getByText } = render(
      <HealthLogDetail
        healthLog={mockHealthLog}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Monday, January 15, 2024')).toBeTruthy();
  });

  it('handles invalid date gracefully', () => {
    const logWithInvalidDate = { ...mockHealthLog, date: 'invalid-date' };
    const { getByText } = render(
      <HealthLogDetail
        healthLog={logWithInvalidDate}
        onClose={mockOnClose}
      />
    );

    expect(getByText('invalid-date')).toBeTruthy();
  });
});