import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PartyForm from '../components/PartyForm.jsx';
import * as partnerService from '../services/partner.service.js';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

export default function PartnerEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    partnerService
      .getPartner(id)
      .then(setInitial)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load partner.')))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    setFormError('');
    try {
      await partnerService.updatePartner(id, payload);
      toast.success('Partner updated successfully.');
      navigate(`/partners/${id}`);
    } catch (err) {
      setSubmitting(false);
      setFormError(getErrorMessage(err, 'Failed to update partner.'));
    }
  }

  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (error) return <ErrorState title="Unable to load partner." message={error} onRetry={() => window.location.reload()} />;

  return (
    <section className="max-w-xl">
      <Link to={`/partners/${id}`} className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← {initial.name}
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Edit Partner</h1>
      <div className="mt-6">
        <PartyForm showStatus submitLabel="Save Partner" initialValues={initial} onSubmit={handleSubmit} submitting={submitting} error={formError} />
      </div>
    </section>
  );
}
