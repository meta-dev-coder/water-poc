import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  UiItemsProvider,
  StagePanelLocation, 
  StagePanelSection, 
  WidgetState, 
  Widget,
  useActiveIModelConnection,
  useActiveViewport
} from "@itwin/appui-react";
import { ColorDef, FeatureOverrideType } from "@itwin/core-common";
import { EmphasizeElements } from "@itwin/core-frontend";

// REPLACE THIS WITH YOUR RENDER URL
const BACKEND_URL = "https://denver-demo.onrender.com"; 
const SIMULATION_URL = "https://sdna.app.n8n.cloud/webhook/simulate-dose";



const SimulationComponent = () => {
  const iModelConnection = useActiveIModelConnection();
  const viewport = useActiveViewport(); // Access the 3D Viewport
  
  const [liveData, setLiveData] = useState<any>(null);
  const [dose, setDose] = useState(12.5);
  const [simResult, setSimResult] = useState<any>(null);

  // 1. Poll Live Data (Same as before)
  useEffect(() => {
    const interval = setInterval(() => {
      axios.get(`${BACKEND_URL}/live-scada`)
        .then(res => setLiveData(res.data.tags))
        .catch(err => console.error(err));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // 2. The Visualizer Logic
  const visualizeImpact = (status: string, turbidity: number) => {
    if (!viewport || !iModelConnection) return;

    const empt = EmphasizeElements.getOrCreate(viewport);
    
    // Get the ID of the currently selected asset (The Tank)
    const selectedIds = iModelConnection.selectionSet.elements;

    if (selectedIds.size === 0) {
      alert("⚠️ Please click on a Tank or Pipe in the 3D model first!");
      return;
    }

    // Clear previous colors
    empt.clearOverriddenElements(viewport);

    // Determine Color based on Simulation Result
    let color = ColorDef.green; // Default Safe
    
    if (status === "CRITICAL VIOLATION") {
      color = ColorDef.red; // Alarm
    } else if (turbidity > 1.0) {
      color = ColorDef.from(139, 69, 19); // Brown (Muddy water)
    } else {
      color = ColorDef.from(0, 0, 255); // Blue (Clean water)
    }

    // Apply the Color Override to the selected 3D Object
    empt.overrideElements(selectedIds, viewport, color, FeatureOverrideType.ColorOnly, true);
    
    // Optional: Isolate it so the user focuses on it (Dim everything else)
    // empt.emphasizeSelectedElements(viewport, undefined, true); 
  };

  const runSimulation = async () => {
    try {

      const res = await axios.post(SIMULATION_URL, { 
        proposed_dosage: parseFloat(dose as any) 
      });
      // const res = await axios.post(`${BACKEND_URL}/simulate`, { proposed_dosage: parseFloat(dose as any) });
      const result = res.data;
      
      setSimResult(result);

      console.log("Sim Result:", result);
      
      // TRIGGER THE VISUALS
      visualizeImpact(result.status, result.scenario.predicted_effluent_turbidity);

    } catch (error) {
      console.error("Sim failed", error);
    }
  };

  return (
    <div style={{ padding: '15px', height: '100%', overflowY: 'auto' }}>
      <div style={{ background: '#2C3E50', padding: '10px', borderRadius: '5px', marginBottom: '15px', color: 'white' }}>
        <h3 style={{ margin: 0 }}>🚰 Live SCADA</h3>
        {liveData ? (
          <div style={{ fontSize: '0.9em', marginTop: '5px' }}>
            <div>Flow: <strong>{liveData.Flow_Rate.toFixed(0)} m³/h</strong></div>
            <div>Inlet Turbidity: <strong>{liveData.Inlet_Turbidity.toFixed(1)} NTU</strong></div>
          </div>
        ) : <span>Connecting...</span>}
      </div>
      
      <div style={{ background: '#34495E', padding: '10px', borderRadius: '5px', color: 'white' }}>
        <h3 style={{ margin: 0 }}>🧪 Scenario Test</h3>
        <p style={{ fontSize: '0.8em', fontStyle: 'italic' }}>
          Select a tank, adjust dosage, and run to see impact.
        </p>
        
        <label>Alum Dosage: <strong>{dose} mg/L</strong></label>
        <input 
          type="range" min="8" max="16" step="0.5" value={dose} 
          onChange={(e) => setDose(parseFloat(e.target.value))}
          style={{ width: '100%', margin: '10px 0' }}
        />
        
        <button 
          onClick={runSimulation} 
          style={{ 
            width: '100%', padding: '8px', cursor: 'pointer',
            background: '#3498DB', color: 'white', border: 'none', borderRadius: '4px' 
          }}
        >
          RUN PREDICTION
        </button>

        {simResult && (
          <div style={{ 
            marginTop: '15px', padding: '10px', borderRadius: '4px',
            background: simResult.status === "Safe" ? '#2ECC71' : '#E74C3C',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
              {simResult.predicted_effluent_turbidity} NTU
            </div>
            <div>{simResult.status}</div>
            <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
              Cost: ${simResult.daily_chemical_cost} / day
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export class SimulationWidgetProvider implements UiItemsProvider {
  public readonly id = "SimulationWidgetProvider";

  public provideWidgets(_stageId: string, _stageUsage: string, location: StagePanelLocation, _section?: StagePanelSection): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    if (location === StagePanelLocation.Right) {
      widgets.push({
        id: "SimulationWidget",
        label: "Decision Support",
        content: <SimulationComponent />,
        defaultState: WidgetState.Open,
      });
    }
    return widgets;
  }
}