import { t as tr } from '../i18n';
// Ruolo del blocco (pannello "Aspetto") e tema dei colori del documento (pannello "Figura").
import { updateNodes } from '../actions';
import type { NodeModel, Role } from '../model';
import { getState, setDoc, useStore } from '../store';
import { ROLES, THEMES, applyTheme, roleColors } from '../themes';
import { toast } from '../ui';
import { Select } from './controls';

export function RoleSelect({ nodes }: { nodes: NodeModel[] }) {
  const theme = useStore((s) => s.doc.settings.theme);
  const roles = new Set(nodes.map((n) => n.role));
  const value = roles.size === 1 ? [...roles][0] : undefined;
  const setRole = (role: Role) => {
    const colors = roleColors(theme, role);
    updateNodes(
      nodes.map((n) => n.id),
      { role, ...(colors ?? {}) },
    );
  };
  return (
    <Select<Role>
      label={tr("Ruolo")}
      value={value}
      options={[['', 'Nessuno'], ...ROLES]}
      onChange={setRole}
    />
  );
}

export function ThemeSelect() {
  const theme = useStore((s) => s.doc.settings.theme);
  const choose = (id: string) => {
    const doc = getState().doc;
    if (!id) {
      setDoc({ ...doc, settings: { ...doc.settings, theme: '' } });
      return;
    }
    setDoc(applyTheme(doc, id));
    toast(tr("Tema «{name}»: colori assegnati per ruolo.", { name: tr(THEMES.find((theme) => theme.id === id)?.name ?? id) }));
  };
  return (
    <Select<string>
      label={tr("Colori")}
      value={theme}
      options={[['', 'Scelti a mano'], ...THEMES.map((t): [string, string] => [t.id, t.name])]}
      onChange={choose}
    />
  );
}

