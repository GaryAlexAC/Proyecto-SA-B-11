import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api';
import type { Account, Payment, Role, Transaction } from '../types';
import { SubmitButton } from './FormFields';

type Notify = (message: string, tone?: 'success' | 'error') => void;

export function AccountsView({ token, role, customerId, notify }: { token: string; role: Role; customerId: string; notify: Notify }) {
  const [lookupId, setLookupId] = useState(customerId);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function load(id = lookupId) {
    if (!id.trim()) return notify('Ingresa el identificador del cliente.', 'error');
    setBusy(true);
    try {
      setAccounts(await api.getAccounts(id.trim(), token));
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { if (role === 'CLIENT') void load(customerId); }, [customerId, role, token]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      await api.createAccount({ customerId: String(form.get('customerId')), accountType: String(form.get('accountType')) }, token);
      notify('Solicitud de cuenta enviada correctamente.');
      await load(String(form.get('customerId')));
      formElement.reset();
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function balance(account: Account) {
    try {
      const response = await api.getBalance(account.id, token);
      setBalances((current) => ({ ...current, [account.id]: formatMoney(response.balance) }));
    } catch (error) {
      notify((error as ApiError).message, 'error');
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading"><div><p className="eyebrow">Productos bancarios</p><h2>Cuentas</h2></div></div>
      {role !== 'CLIENT' && (
        <div className="two-column-actions">
          <form className="form-card compact-form" onSubmit={create}>
            <h3>Abrir una cuenta</h3>
            <label>ID del cliente<input name="customerId" required /></label>
            <label>Tipo<select name="accountType" defaultValue="MONETARY"><option value="MONETARY">Monetaria</option><option value="SAVINGS">Ahorro</option></select></label>
            <SubmitButton busy={busy}>Crear cuenta</SubmitButton>
          </form>
          <div className="form-card compact-form">
            <h3>Consultar por cliente</h3>
            <label>ID del cliente<input value={lookupId} onChange={(event) => setLookupId(event.target.value)} /></label>
            <button className="secondary-button" onClick={() => void load()} disabled={busy}>Consultar cuentas</button>
          </div>
        </div>
      )}
      <div className="card-grid">
        {accounts.map((account, index) => (
          <article className="account-card" key={account.id}>
            <span className="account-index">{String(index + 1).padStart(2, '0')}</span>
            <p>{account.type ?? account.accountType ?? 'Cuenta bancaria'}</p>
            <h3>{account.accountNumber ?? account.id}</h3>
            <div><strong>{balances[account.id] ?? (account.balance !== undefined ? formatMoney(account.balance) : 'Saldo protegido')}</strong><button onClick={() => void balance(account)}>Consultar saldo</button></div>
          </article>
        ))}
      </div>
      {!busy && accounts.length === 0 && <div className="empty-state roomy">No hay cuentas para mostrar.</div>}
    </section>
  );
}

export function TransactionsView({ token, customerId, notify }: { token: string; customerId: string; notify: Notify }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState('');

  async function load() {
    setBusy(true);
    try {
      setTransactions(await api.getTransactions(customerId, token));
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, [customerId, token]);

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      await api.createTransaction({ sourceAccountId: String(form.get('sourceAccountId')), destinationAccountId: String(form.get('destinationAccountId')), amount: Number(form.get('amount')) }, token);
      notify('Transferencia solicitada. Puedes consultar su estado en el historial.');
      formElement.reset();
      await load();
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function findTransaction() {
    if (!lookup.trim()) return;
    try {
      const transaction = await api.getTransaction(lookup.trim(), token);
      setTransactions((current) => [transaction, ...current.filter((item) => item.id !== transaction.id)]);
    } catch (error) {
      notify((error as ApiError).message, 'error');
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading"><div><p className="eyebrow">Movimiento entre cuentas</p><h2>Transferencias</h2></div><button className="ghost-button" onClick={() => void load()}>Actualizar</button></div>
      <div className="two-column-actions">
        <form className="form-card compact-form" onSubmit={transfer}>
          <h3>Nueva transferencia</h3>
          <label>Cuenta origen<input name="sourceAccountId" required /></label>
          <label>Cuenta destino<input name="destinationAccountId" required /></label>
          <label>Monto en quetzales<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <SubmitButton busy={busy}>Transferir</SubmitButton>
        </form>
        <div className="form-card compact-form">
          <h3>Consultar operación</h3>
          <label>ID de transferencia<input value={lookup} onChange={(event) => setLookup(event.target.value)} /></label>
          <button className="secondary-button" onClick={() => void findTransaction()}>Consultar estado</button>
        </div>
      </div>
      <RecordList records={transactions} empty="Aún no hay transferencias registradas." />
    </section>
  );
}

export function PaymentsView({ token, notify }: { token: string; notify: Notify }) {
  const [payment, setPayment] = useState<Payment>();
  const [lookup, setLookup] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const created = await api.createPayment({ transactionId: String(form.get('transactionId')), amount: Number(form.get('amount')) }, token);
      setPayment(created);
      notify('Pago enviado para procesamiento.');
      formElement.reset();
    } catch (error) {
      notify((error as ApiError).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function findPayment() {
    if (!lookup.trim()) return;
    try {
      setPayment(await api.getPayment(lookup.trim(), token));
    } catch (error) {
      notify((error as ApiError).message, 'error');
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading"><div><p className="eyebrow">Procesamiento interno</p><h2>Pagos</h2></div></div>
      <div className="two-column-actions">
        <form className="form-card compact-form" onSubmit={create}>
          <h3>Solicitar pago</h3>
          <label>ID de transacción<input name="transactionId" required /></label>
          <label>Monto en quetzales<input name="amount" type="number" min="0.01" step="0.01" required /></label>
          <SubmitButton busy={busy}>Procesar pago</SubmitButton>
        </form>
        <div className="form-card compact-form">
          <h3>Consultar pago</h3>
          <label>ID del pago<input value={lookup} onChange={(event) => setLookup(event.target.value)} /></label>
          <button className="secondary-button" onClick={() => void findPayment()}>Consultar estado</button>
          {payment && <div className="result-box"><span>{payment.status ?? 'Procesando'}</span><strong>{payment.id}</strong><small>{payment.reason ?? (payment.amount !== undefined ? formatMoney(payment.amount) : 'Solicitud recibida')}</small></div>}
        </div>
      </div>
    </section>
  );
}

function RecordList({ records, empty }: { records: Transaction[]; empty: string }) {
  if (records.length === 0) return <div className="empty-state roomy">{empty}</div>;
  return <div className="record-list">{records.map((record) => <article key={record.id}><div><strong>{record.destinationAccountId ?? 'Transferencia'}</strong><small>{record.createdAt ? new Date(record.createdAt).toLocaleString('es-GT') : record.id}</small></div><span>{record.amount !== undefined ? formatMoney(record.amount) : 'Monto pendiente'}</span><b>{record.status ?? 'Solicitada'}</b></article>)}</div>;
}

function formatMoney(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount) : String(value);
}
