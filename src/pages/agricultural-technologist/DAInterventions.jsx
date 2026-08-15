import { AgritechLayout } from '../../components/agritech/AgritechLayout';
import { InterventionList } from '../../components/agritech/InterventionList';

function DAInterventions() {
  return (
    <AgritechLayout
      title="DA Intervention"
      description="Department of Agriculture intervention programs"
    >
      <InterventionList type="DA" />
    </AgritechLayout>
  );
}

export default DAInterventions;
