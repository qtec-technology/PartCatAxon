import { ArrowLeft, Save, X, Edit, LogOut, Mail, Trash2 } from 'lucide-react';
import { Button, Badge } from '../common/atoms';

interface TermHeaderProps {
  mode: 'new' | 'view' | 'edit';
  itemCode: string;
  onSave: () => void;
  onExit: () => void;
  onBack: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onSendRfq?: () => void;
  isSendingRfq?: boolean;
  disableMutations?: boolean;
  disableSave?: boolean;
  disableEdit?: boolean;
  disableDelete?: boolean;
}

export function TermHeader({
  mode,
  itemCode,
  onSave,
  onExit,
  onBack,
  onEdit,
  onCancel,
  onDelete,
  onSendRfq,
  isSendingRfq = false,
  disableMutations = false,
  disableSave = false,
  disableEdit = false,
  disableDelete = false,
}: TermHeaderProps) {
  const modeConfig = {
    new: { label: 'ADD NEW TERM', bgColor: 'bg-term-green' },
    view: { label: 'TERM', bgColor: 'bg-term-blue' },
    edit: { label: 'EDIT TERM', bgColor: 'bg-term-blue-dark' },
  };
  const cfg = modeConfig[mode];
  const actionBtnCls = 'h-9 min-w-[112px] shrink-0 whitespace-nowrap';
  const wideActionBtnCls = 'h-9 min-w-[128px] shrink-0 whitespace-nowrap';

  return (
    <div className="bg-white border-b border-gray-200 px-[15px] py-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3 md:gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-600 h-9 shrink-0 whitespace-nowrap">
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </Button>
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-3">
            <h1 className="truncate text-lg font-bold text-gray-800 md:text-xl">
              {mode === 'new' ? 'ADD NEW TERM' : `TERM - ${itemCode}`}
            </h1>
            <span className={`${cfg.bgColor} text-white px-3 py-1 rounded text-sm font-bold`}>
              {cfg.label}
            </span>
            {mode !== 'new' && <Badge>{itemCode}</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
          {/* NEW mode: only Save + Exit */}
          {mode === 'new' && (
            <>
              <Button variant="success" onClick={onSave} disabled={disableMutations || disableSave} title={disableMutations || disableSave ? 'Save disabled' : 'Save'} className={actionBtnCls}>
                <Save className="w-4 h-4" /> SAVE
              </Button>
              <Button variant="neutral" onClick={onExit} className={actionBtnCls}>
                <LogOut className="w-4 h-4" /> EXIT
              </Button>
            </>
          )}

          {/* VIEW mode: Print, Send RFQ, Delete, Exit, Edit */}
          {mode === 'view' && (
            <>
              <Button variant="primary" onClick={onSendRfq} disabled={isSendingRfq} className={wideActionBtnCls}>
                <Mail className="w-4 h-4" /> {isSendingRfq ? 'LOADING...' : 'SEND RFQ'}
              </Button>
              <Button
                variant="danger"
                onClick={onDelete}
                disabled={disableDelete || disableMutations}
                title={disableDelete || disableMutations ? 'Delete disabled' : 'Delete'}
                className={actionBtnCls}
              >
                <Trash2 className="w-4 h-4" /> DELETE
              </Button>
              <Button variant="neutral" onClick={onExit} className={actionBtnCls}>
                <LogOut className="w-4 h-4" /> EXIT
              </Button>
              <Button
                variant="warning"
                onClick={onEdit}
                disabled={disableEdit}
                title={disableEdit ? 'Edit disabled' : 'Edit'}
                className={actionBtnCls}
              >
                <Edit className="w-4 h-4" /> EDIT
              </Button>
            </>
          )}

          {/* EDIT mode: Save, Cancel, Exit */}
          {mode === 'edit' && (
            <>
              <Button variant="success" onClick={onSave} disabled={disableMutations || disableSave} title={disableMutations || disableSave ? 'Save disabled' : 'Save'} className={actionBtnCls}>
                <Save className="w-4 h-4" /> SAVE
              </Button>
              <Button variant="neutral" onClick={onCancel} className={actionBtnCls}>
                <X className="w-4 h-4" /> CANCEL
              </Button>
              <Button variant="neutral" onClick={onExit} className={actionBtnCls}>
                <LogOut className="w-4 h-4" /> EXIT
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
