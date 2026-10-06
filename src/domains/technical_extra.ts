// Estensione dei domini sperimentali: ogni blocco resta vettoriale e modificabile.
import { Builder } from '../builder';
import { COLORS, ICON, type NodeModel, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates, type TemplateDef } from '../registry';
import { TECHNICAL_EXTRA_SHAPES } from './technical_extra-shapes';

const { BLUE, GREEN, ORANGE, PURPLE, TEAL, WHITE, GRAY } = COLORS;
registerShapes(TECHNICAL_EXTRA_SHAPES);
const library:Preset[]=[];
function add(id:string,name:string,category:string,shape:string,spec:string,label:string,extra:Partial<NodeModel>={}){
 library.push({id:`labx-${id}`,name,category,node:{...ICON,...WHITE,shape:`labx-${shape}`,spec,label,w:116,h:76,strokeWidth:1.1,fontSize:10,...extra}});
}
for(const [spec,name,label]of [
 ['hann','Finestra di Hann','Hann window'],['hamming','Finestra di Hamming','Hamming window'],['blackman','Finestra di Blackman','Blackman window'],['bartlett','Finestra triangolare','Bartlett window'],
 ['auto','Autocorrelazione','Autocorrelation'],['cross','Correlazione incrociata','Cross-correlation'],['envelope','Inviluppo analitico','Analytic envelope'],['cepstrum','Cepstrum','Cepstrum'],
])add(spec,name,'Segnali','signal',spec,label);
add('polyphase','Banco polifase','DSP','polyphase','','Polyphase branches',{count:3,w:120,h:84});
for(const [spec,name,label]of [
 ['gain','Bode (modulo)','Magnitude response'],['phase','Bode (fase)','Phase response'],['nyquist','Diagramma di Nyquist','Nyquist plot'],['phaseportrait','Ritratto di fase','Phase portrait'],['covariance','Ellisse di covarianza','State uncertainty'],['poles','Poli nel piano s','Continuous-time poles'],
])add(`control-${spec}`,name,'Controllo','control',spec,label);
for(const [spec,name,label]of [['imu','Unità inerziale IMU','Inertial measurement'],['voxel','Voxelizzazione punti','Voxel grid'],['costmap','Mappa dei costi','Inflated costmap'],['smooth','Percorso regolarizzato','Path smoothing']])add(`robot-${spec}`,name,'Robotica','robotics',spec,label);
for(const [spec,name,label]of [
 ['barcode','Barcode cellulare + UMI','Cell barcode + UMI'],['umi','Deduplicazione UMI','UMI deduplication'],['adapter','Taglio degli adattatori','Adapter trimming'],['quality','Qualità per base','Per-base quality'],['coverage','Copertura genomica','Read coverage'],['methylation','Metilazione CpG','CpG methylation'],['atac','Picchi di accessibilità','Accessibility peaks'],['paired','Reads paired-end','Paired-end reads'],
])add(`gen-${spec}`,name,'Genomica','genomics',spec,label);
for(const [spec,name,label]of [['membrane','Proteina transmembrana','Transmembrane protein'],['disulfide','Ponte disolfuro','Disulfide bond'],['ptm','Modifiche post-traduzionali','Post-translational modifications']])add(`protein-${spec}`,name,'Proteine','protein',spec,label);
for(const [spec,name,label]of [['stress','Curva sforzo-deformazione','Stress–strain curve'],['dos','Densità degli stati','Density of states'],['bands','Bande e gap energetico','Electronic bands'],['phase','Diagramma di fase P–T','Phase diagram']])add(`material-${spec}`,name,'Materiali','material',spec,label);
add('opt-comb','Pettine di frequenze','Fotonica','optics','comb','Optical frequency comb');
add('opt-polarization','Ellisse di polarizzazione','Ottica','optics','ellipse','Polarization ellipse');
add('density-pure','Matrice densità (puro)','Quantum computing','density','pure','Pure-state density matrix',{w:84,h:84});
add('density-mixed','Matrice densità (misto)','Quantum computing','density','mixed','Maximally mixed state',{w:84,h:84});
add('dephase','Perdita di coerenza','Quantum computing','density','dephase','Complete dephasing',{w:150,h:80});
registerPresets(library);

const templates:TemplateDef[]=[];
const preset=(t:Builder,id:string,x:number,y:number,extra:Partial<NodeModel>={})=>{
 const item=library.find(p=>p.id===`labx-${id}`);if(!item)throw new Error(`Blocco sperimentale mancante: ${id}`);
 return t.add({...item.node,x,y,...extra});
};
const template=(id:string,name:string,section:string,build:()=>ReturnType<Builder['done']>)=>templates.push({id:`labx-${id}`,name,section,build});

template('analytic-signal','Segnale analitico e inviluppo','Signal processing',()=>{
 const t=new Builder();
 const input=t.icon('waveform','Real signal',0,72,100,55,BLUE);
 const ht=t.box('Hilbert transform',155,18,145,44,PURPLE);
 const delay=t.box('Real component',155,115,145,44,WHITE);
 const z=t.box('Analytic signal\nx(t) + j H{x(t)}',354,65,150,64,TEAL);
 const magnitude=t.box('Magnitude',560,75,98,44,GREEN);
 const output=preset(t,'envelope',710,53);
 t.link(input,ht,'right','left');t.link(input,delay,'right','left');t.link(ht,z);t.link(delay,z);t.chain([z,magnitude,output]);
 return t.done();
});
template('polyphase-decimator','Decimazione con banco polifase','Signal processing',()=>{
 const t=new Builder();const input=t.icon('waveform','Input stream',0,67,90,48,BLUE);
 const split=t.box('Demultiplex\nM phases',135,57,115,65,WHITE);
 const bank=preset(t,'polyphase',302,42,{count:4,h:100});
 const sum=t.op('$\\sum$',480,78);const output=t.box('Output stream\ny[m]',555,63,125,56,GREEN);
 t.chain([input,split,bank,sum,output]);t.text('Branch filters operate at the reduced rate',262,177,370,24,{fontSize:11});return t.done();
});
template('frequency-control','Analisi in frequenza di un sistema','Robotica e controllo',()=>{
 const t=new Builder();const system=t.box('Transfer function\nG(s)',0,158,128,60,WHITE);
 const gain=preset(t,'control-gain',222,0),phase=preset(t,'control-phase',222,150),nyquist=preset(t,'control-nyquist',222,300);
 const decision=t.box('Margins &\nstability assessment',468,155,160,66,GREEN);
 for(const graph of [gain,phase,nyquist]){t.link(system,graph);t.link(graph,decision);}return t.done();
});
template('local-planning','Pianificazione locale con costmap','Robotica e controllo',()=>{
 const t=new Builder();const sensors=t.box('Range sensors',0,83,108,48,BLUE);const cost=preset(t,'robot-costmap',156,64);
 const search=t.box('Collision-free\npath search',330,83,123,48,PURPLE);const smooth=preset(t,'robot-smooth',505,63);
 const tracker=t.box('Trajectory\ntracking',680,82,119,50,GREEN);t.chain([sensors,cost,search,smooth,tracker]);
 const feedback=t.box('State estimate',361,213,128,44,ORANGE);t.link(tracker,feedback,'bottom','right',{routing:'ortho'});t.link(feedback,search,'top','bottom',{routing:'ortho'});return t.done();
});
template('umi-counts','Dai barcode ai conteggi UMI','Genomica e proteine',()=>{
 const t=new Builder();const reads=preset(t,'gen-barcode',0,36);const align=t.box('Assign reads\nto genes',169,57,129,50,BLUE);
 const dedup=preset(t,'gen-umi',350,36);const matrix=t.icon('heatmap','Gene × cell counts',521,30,94,84,GREEN,{spec:'6x6'});t.chain([reads,align,dedup,matrix]);
 t.text('Group by cell barcode + gene + UMI before counting',85,171,510,26,{fontSize:12});return t.done();
});
template('atac-fragments','ATAC-seq: frammenti e picchi','Genomica e proteine',()=>{
 const t=new Builder();const paired=preset(t,'gen-paired',0,40);const align=t.box('Align paired reads\n& filter fragments',165,57,154,52,BLUE);
 const peaks=preset(t,'gen-atac',372,40);const matrix=t.icon('heatmap','Peak × cell matrix',547,35,88,84,TEAL,{spec:'6x6'});const cluster=t.box('Reduced space\n& cell clusters',686,58,151,51,PURPLE);
 t.chain([paired,align,peaks,matrix,cluster]);return t.done();
});
template('materials-profile','Caratterizzazione di un materiale','Chimica e molecole',()=>{
 const t=new Builder();const sample=t.box('Material sample',0,117,126,52,GRAY);
 const mechanical=preset(t,'material-stress',206,0);const electronic=preset(t,'material-bands',206,124);const thermodynamic=preset(t,'material-phase',206,249);
 const report=t.box('Property profile\n& operating region',459,116,167,59,GREEN);
 for(const n of [mechanical,electronic,thermodynamic]){t.link(sample,n);t.link(n,report);}return t.done();
});
template('polarization-analysis','Analisi della polarizzazione','Ottica e fotonica',()=>{
 const t=new Builder();const state=preset(t,'opt-polarization',0,63);const analyzer=t.box('Analyzer settings\nH / V / D / R',167,77,138,57,PURPLE);
 const measurements=t.icon('barchart','Intensity measurements',358,62,104,81,BLUE,{count:4});const stokes=t.box('Stokes parameters\n$S_0, S_1, S_2, S_3$',518,77,156,56,GREEN);t.chain([state,analyzer,measurements,stokes]);return t.done();
});
template('dephasing-channel','Decoerenza nella matrice densità','Quantum computing',()=>{
 const t=new Builder();const pure=preset(t,'density-pure',0,37);const channel=preset(t,'dephase',150,40);const mixed=preset(t,'density-mixed',366,37);
 t.chain([pure,channel,mixed]);t.text('Complete dephasing removes off-diagonal coherences',12,174,484,28,{fontSize:12});return t.done();
});
registerTemplates(templates);
