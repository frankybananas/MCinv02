/**
 * UserList Component Test Suite
 * 
 * Tests user list display, toggles, edit/delete actions, and dialogs
 * Target Coverage: 80%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserList from '@/app/components/admin/user-list';

// Mock EditUserDialog
jest.mock('@/app/components/admin/edit-user-dialog', () => {
  return function MockEditUserDialog({ user, open, onOpenChange, onSuccess }: any) {
    if (!open) return null;
    return (
      <div data-testid="edit-dialog">
        <h2>Edit User Dialog</h2>
        <p>Editing: {user?.profile.firstName}</p>
        <button onClick={() => onOpenChange(false)}>Close</button>
        <button onClick={() => { onSuccess(); onOpenChange(false); }}>Save</button>
      </div>
    );
  };
});

// Mock fetch
global.fetch = jest.fn();

const mockUsers = [
  {
    _id: 'user1',
    phone: '+1234567890',
    profile: { firstName: 'John', lastName: 'Doe' },
    department: 'new',
    role: 'user',
    matchingEnabled: true,
    todoEnabled: false,
    marketingEnabled: false,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    _id: 'user2',
    phone: '+0987654321',
    profile: { firstName: 'Jane', lastName: 'Smith' },
    department: 'used',
    role: 'manager',
    matchingEnabled: true,
    todoEnabled: true,
    marketingEnabled: true,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
];

describe('UserList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUsers }),
    });
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      render(<UserList />);
      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });

    it('should render user list after loading', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should render all table headers', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Phone')).toBeInTheDocument();
        expect(screen.getByText('Department')).toBeInTheDocument();
        expect(screen.getByText('Role')).toBeInTheDocument();
        expect(screen.getByText('Matching')).toBeInTheDocument();
        expect(screen.getByText('TODO')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('should render user data correctly', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('+1234567890')).toBeInTheDocument();
        expect(screen.getByText('+0987654321')).toBeInTheDocument();
      });
    });

    it('should render error state when fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to fetch' }),
      });

      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });
  });

  describe('Toggle Features', () => {
    it('should toggle matching enabled', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const matchingCheckbox = checkboxes[0]; // First user's matching checkbox

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      fireEvent.click(matchingCheckbox);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ userId: 'user1', matchingEnabled: false }),
          })
        );
      });
    });

    it('should toggle todo enabled', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const todoCheckbox = checkboxes[1]; // First user's todo checkbox

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      fireEvent.click(todoCheckbox);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ userId: 'user1', todoEnabled: true }),
          })
        );
      });
    });

    it('should toggle marketing enabled', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const marketingCheckbox = checkboxes[2]; // First user's marketing checkbox

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      fireEvent.click(marketingCheckbox);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ userId: 'user1', marketingEnabled: true }),
          })
        );
      });
    });

    it('should show alert on toggle error', async () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      });

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Update failed');
      });

      alertMock.mockRestore();
    });
  });

  describe('Edit User', () => {
    it('should open edit dialog when edit button clicked', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit user');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
        expect(screen.getByText('Editing: John')).toBeInTheDocument();
      });
    });

    it('should close edit dialog and reload on save', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit user');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByTestId('edit-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete User', () => {
    it('should open delete confirmation dialog when delete button clicked', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete user');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(screen.getByText(/permanently delete John Doe's account/)).toBeInTheDocument();
      });
    });

    it('should delete user when confirmed', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete user');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'User deleted successfully' }),
      });

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/users?userId=user1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    it('should close dialog when cancel clicked', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete user');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
      });
    });

    it('should show alert on delete error', async () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTitle('Delete user');
      fireEvent.click(deleteButtons[0]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Delete failed' }),
      });

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Delete failed');
      });

      alertMock.mockRestore();
    });
  });

  describe('Checkbox States', () => {
    it('should show correct checkbox states for enabled features', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Jane Smith (user2) has all features enabled
      expect(checkboxes[3]).toBeChecked(); // matching
      expect(checkboxes[4]).toBeChecked(); // todo
      expect(checkboxes[5]).toBeChecked(); // marketing
    });

    it('should show correct checkbox states for disabled features', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      
      // John Doe (user1) has todo and marketing disabled
      expect(checkboxes[0]).toBeChecked(); // matching enabled
      expect(checkboxes[1]).not.toBeChecked(); // todo disabled
      expect(checkboxes[2]).not.toBeChecked(); // marketing disabled
    });
  });

  describe('Data Reload', () => {
    it('should reload data after successful toggle', async () => {
      render(<UserList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Initial fetch + reload after toggle
      expect(global.fetch).toHaveBeenCalledTimes(1);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + toggle + reload
      });
    });
  });
});
