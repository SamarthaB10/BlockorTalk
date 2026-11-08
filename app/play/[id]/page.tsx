import { CallScreen } from './CallScreen';
import '../play.css';
export default async function CallPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{drill?:string|string[]}>}){const {id}=await params;const {drill}=await searchParams;return <CallScreen scenarioId={id} drill={Array.isArray(drill)?drill[0]:drill}/>;}
