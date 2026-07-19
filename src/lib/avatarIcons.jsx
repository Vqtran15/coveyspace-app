import {
  // Plants
  Leaf, FlowerLotus, Tree, Plant, Acorn, Feather,
  Cactus, PottedPlant, TreeEvergreen, FlowerTulip, TreePalm, Flower,
  // Sky & space
  Sun, Moon, Snowflake, Rainbow, CloudSun,
  MoonStars, ShootingStar, Lightning, Sparkle,
  // Animals (Dog, Fish, Butterfly kept — in use)
  Dog, Fish, Butterfly, PawPrint, Bug,
  // Food & drink (Cherries kept — in use)
  Coffee, Cookie, IceCream, Cherries, Pizza, Hamburger, Flame, Campfire,
  // Faith & heart
  HandsPraying, Heart, Peace, Handshake, HandHeart, Infinity,
  // Achievement
  Star,
  // Creative
  MusicNote, Guitar, Book, Palette, Camera, MagicWand,
  PianoKeys, Microphone, VinylRecord,
  // Activity & misc
  Smiley, Sailboat,
  // Travel
  Mountains, Tent, Boat,
  // Fun & misc
  Balloon, Confetti, Popcorn, Anchor,
} from '@phosphor-icons/react'

export { avatarColor, AVATAR_COLOR_OPTIONS, AvatarCircle } from './avatarDisplay.jsx'

export const AVATAR_ICON_LIST = [
  // Plants
  { name: 'Leaf',          Icon: Leaf },
  { name: 'FlowerLotus',   Icon: FlowerLotus },
  { name: 'Tree',          Icon: Tree },
  { name: 'Plant',         Icon: Plant },
  { name: 'Acorn',         Icon: Acorn },
  { name: 'Feather',       Icon: Feather },
  { name: 'Cactus',        Icon: Cactus },
  { name: 'PottedPlant',   Icon: PottedPlant },
  { name: 'TreeEvergreen', Icon: TreeEvergreen },
  { name: 'FlowerTulip',   Icon: FlowerTulip },
  { name: 'TreePalm',      Icon: TreePalm },
  { name: 'Flower',        Icon: Flower },
  // Sky & space
  { name: 'Sun',           Icon: Sun },
  { name: 'Moon',          Icon: Moon },
  { name: 'Snowflake',     Icon: Snowflake },
  { name: 'Rainbow',       Icon: Rainbow },
  { name: 'CloudSun',      Icon: CloudSun },
  { name: 'MoonStars',     Icon: MoonStars },
  { name: 'ShootingStar',  Icon: ShootingStar },
  { name: 'Lightning',     Icon: Lightning },
  { name: 'Sparkle',       Icon: Sparkle },
  // Animals
  { name: 'Dog',           Icon: Dog },
  { name: 'Fish',          Icon: Fish },
  { name: 'Butterfly',     Icon: Butterfly },
  { name: 'PawPrint',      Icon: PawPrint },
  { name: 'Bug',           Icon: Bug },
  // Food & drink
  { name: 'Coffee',        Icon: Coffee },
  { name: 'Cookie',        Icon: Cookie },
  { name: 'IceCream',      Icon: IceCream },
  { name: 'Cherries',      Icon: Cherries },
  { name: 'Pizza',         Icon: Pizza },
  { name: 'Hamburger',     Icon: Hamburger },
  { name: 'Flame',         Icon: Flame },
  { name: 'Campfire',      Icon: Campfire },
  // Faith & heart
  { name: 'HandsPraying',  Icon: HandsPraying },
  { name: 'Heart',         Icon: Heart },
  { name: 'Peace',         Icon: Peace },
  { name: 'Handshake',     Icon: Handshake },
  { name: 'HandHeart',     Icon: HandHeart },
  { name: 'Infinity',      Icon: Infinity },
  // Achievement
  { name: 'Star',          Icon: Star },
  // Creative
  { name: 'MusicNote',     Icon: MusicNote },
  { name: 'Guitar',        Icon: Guitar },
  { name: 'Book',          Icon: Book },
  { name: 'Palette',       Icon: Palette },
  { name: 'Camera',        Icon: Camera },
  { name: 'MagicWand',     Icon: MagicWand },
  { name: 'PianoKeys',     Icon: PianoKeys },
  { name: 'Microphone',    Icon: Microphone },
  { name: 'VinylRecord',   Icon: VinylRecord },
  // Activity & misc
  { name: 'Smiley',        Icon: Smiley },
  { name: 'Sailboat',      Icon: Sailboat },
  // Travel
  { name: 'Mountains',     Icon: Mountains },
  { name: 'Tent',          Icon: Tent },
  { name: 'Boat',          Icon: Boat },
  // Fun & misc
  { name: 'Balloon',       Icon: Balloon },
  { name: 'Confetti',      Icon: Confetti },
  { name: 'Popcorn',       Icon: Popcorn },
  { name: 'Anchor',        Icon: Anchor },
]

const ICON_MAP = Object.fromEntries(AVATAR_ICON_LIST.map(({ name, Icon }) => [name, Icon]))

export function AvatarIcon({ name, size = 18, className = 'text-white' }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return <Icon size={size} weight="fill" className={className} />
}
