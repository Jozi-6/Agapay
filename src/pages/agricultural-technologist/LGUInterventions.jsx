import { AgritechLayout } from '../../components/agritech/AgritechLayout';
import { InterventionList } from '../../components/agritech/InterventionList';

function LGUInterventions() {
  return (
    <AgritechLayout
      title="LGU Intervention"
      description="Local Government Unit intervention programs"
    >
      <InterventionList type="LGU" />
    </AgritechLayout>
  );
}

export default LGUInterventions;
