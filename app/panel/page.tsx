import OwnerPanelGate from '@/components/product/owner-panel-gate';
import AppointmentsDefaultAll from '@/components/product/appointments-default-all';

export default function Page(){
  return (
    <>
      <OwnerPanelGate/>
      <AppointmentsDefaultAll/>
    </>
  );
}
