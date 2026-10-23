import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-400-italic.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-700-italic.css';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-400-italic.css';
import '@fontsource/open-sans/latin-700.css';
import '@fontsource/open-sans/latin-700-italic.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-400-italic.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/lato/latin-700-italic.css';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-400-italic.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-700-italic.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-400-italic.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-700-italic.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-400-italic.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-700-italic.css';
import '@fontsource/merriweather/latin-400.css';
import '@fontsource/merriweather/latin-400-italic.css';
import '@fontsource/merriweather/latin-700.css';
import '@fontsource/merriweather/latin-700-italic.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-700-italic.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-400-italic.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/source-sans-3/latin-700-italic.css';
import '@fontsource/roboto-mono/latin-400.css';
import '@fontsource/roboto-mono/latin-400-italic.css';
import '@fontsource/roboto-mono/latin-700.css';
import '@fontsource/roboto-mono/latin-700-italic.css';
export const FONTS=['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Merriweather', 'Playfair Display', 'Source Sans 3', 'Roboto Mono'] as const;
const loaded=new Map<string,Promise<void>>();
export function loadFont(family:string,bold=false,italic=false):Promise<void>{
 const descriptor=`${italic?'italic':'normal'} ${bold?700:400} 48px "${family}"`;
 let pending=loaded.get(descriptor);
 if(!pending){pending=document.fonts.load(descriptor,'Ordo').then(faces=>{if(!faces.length)throw new Error(`Font ${family} could not be loaded. Choose another bundled font.`);});loaded.set(descriptor,pending);pending.catch(()=>loaded.delete(descriptor));}
 return pending;
}
export async function loadProjectFonts(project:{texts?:{fontFamily:string;bold:boolean;italic:boolean}[]}){
 await Promise.all((project.texts??[]).map(t=>loadFont(t.fontFamily,t.bold,t.italic)));
}
