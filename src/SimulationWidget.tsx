import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Everything now comes from appui-react in v4.0+
import { 
  UiItemsProvider,
  StagePanelLocation, 
  StagePanelSection, 
  WidgetState, 
  Widget 
} from "@itwin/appui-react";

// REPLACE THIS WITH YOUR RENDER URL
const BACKEND_URL = "https://denver-demo.onrender.com"; 

const SimulationComponent = () => {
  const [liveData, setLiveData] = useState<any>(null);
  const [dose, setDose] = useState(12.5);
  const [simResult, setSimResult] = useState<any>(null);

  // Poll "Live" SCADA data every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      axios.get(`${BACKEND_URL}/live-scada`)
        .then(res => setLiveData(res.data.tags))
        .catch(err => console.error(err));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const runSimulation = async () => {
    const res = await axios.post(`${BACKEND_URL}/simulate`, { proposed_dosage: parseFloat(dose as any) });
    setSimResult(res.data);
  };

  return (
    <div style={{ padding: '15px', color: 'white', background: '#333', height: '100%' }}>
      <h3>🚰 Plant Status (Live)</h3>
      {liveData ? (
        <ul>
          <li>Flow: {liveData.Flow_Rate.toFixed(1)} m3/hr</li>
          <li>Inlet Turbidity: {liveData.Inlet_Turbidity.toFixed(1)} NTU</li>
          <li>Effluent Quality: {liveData.Effluent_Quality.toFixed(2)} NTU</li>
        </ul>
      ) : <p>Connecting to SCADA...</p>}

      <hr />
      
      <h3>🧪 What-If Simulator</h3>
      <label>Adjust Alum Dosage (mg/L): {dose}</label>
      <input 
        type="range" min="5" max="20" step="0.5" value={dose} 
        onChange={(e) => setDose(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
      <button onClick={runSimulation} style={{ marginTop: '10px', padding: '5px 10px' }}>
        Run Simulation
      </button>

      {simResult && (
        <div style={{ marginTop: '15px', padding: '10px', background: simResult.status === "Safe" ? '#2ecc71' : '#e74c3c' }}>
          <strong>Prediction:</strong><br/>
          Turbidity: {simResult.predicted_effluent_turbidity} NTU<br/>
          Cost: ${simResult.daily_chemical_cost} / day<br/>
          Status: {simResult.status}
        </div>
      )}
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