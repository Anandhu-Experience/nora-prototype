import { Award, BarChart3, Clock, MapPin, MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Insight } from '../selectors'

export const INSIGHT_ICON: Record<Insight['icon'], ReactNode> = {
  star: <MessageSquare size={15} />, chart: <BarChart3 size={15} />, pin: <MapPin size={15} />, clock: <Clock size={15} />, award: <Award size={15} />,
}
