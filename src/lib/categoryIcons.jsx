import {
  Utensils, Car, HeartPulse, Star, Zap, Briefcase, Package,
  Sun, Moon, ShoppingCart, Coffee, Bike, TrainFront, Fuel,
  Milestone, Pill, Stethoscope, ShieldCheck, Wine, Tv,
  Trophy, Plane, Lightbulb, Flame, Wifi, Home, Smartphone,
  Activity, Wrench, ArrowLeftRight,
} from 'lucide-react'

const ICON_MAP = {
  'utensils': Utensils,
  'car': Car,
  'heart-pulse': HeartPulse,
  'star': Star,
  'zap': Zap,
  'briefcase': Briefcase,
  'package': Package,
  'sun': Sun,
  'moon': Moon,
  'shopping-cart': ShoppingCart,
  'coffee': Coffee,
  'bike': Bike,
  'train-front': TrainFront,
  'fuel': Fuel,
  'milestone': Milestone,
  'pill': Pill,
  'stethoscope': Stethoscope,
  'shield-check': ShieldCheck,
  'wine': Wine,
  'tv': Tv,
  'trophy': Trophy,
  'plane': Plane,
  'lightbulb': Lightbulb,
  'flame': Flame,
  'wifi': Wifi,
  'home': Home,
  'smartphone': Smartphone,
  'activity': Activity,
  'wrench': Wrench,
  'arrow-left-right': ArrowLeftRight,
}

export function CategoryIcon({ name, size = 14, color, style = {} }) {
  const Icon = ICON_MAP[name] || Package
  return <Icon size={size} color={color} style={style} />
}
