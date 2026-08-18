import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

export function useDelete({ deleteFn, successMessage = 'Deleted successfully.', errorMessage = 'Failed to delete.', onSuccess }) {
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const askDelete = (item) => setPendingDelete(item ?? true);
  const cancelDelete = () => setPendingDelete(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteFn(pendingDelete);
      setPendingDelete(null);
      toast.success(typeof successMessage === 'function' ? successMessage(pendingDelete) : successMessage);
      onSuccess?.(pendingDelete);
    } catch (err) {
      setPendingDelete(null);
      setDeleting(false);
      toast.error(getErrorMessage(err, errorMessage));
    }
  };

  return { pendingDelete, deleting, askDelete, cancelDelete, confirmDelete };
}
