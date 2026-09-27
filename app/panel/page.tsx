import Dashboard from '@/components/product/dashboard';
import AppointmentsDefaultAll from '@/components/product/appointments-default-all';
import PanelRoleGate from '@/components/product/panel-role-gate';

export default function Page(){
  return (
    <PanelRoleGate>
      <Dashboard/>
      <AppointmentsDefaultAll/>
    </PanelRoleGate>
  );
}
