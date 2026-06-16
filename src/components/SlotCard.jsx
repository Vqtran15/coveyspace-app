const TAG_STYLES = {
  'Vegan':        'bg-green-100 text-green-700',
  'Vegetarian':   'bg-emerald-100 text-emerald-700',
  'Gluten-Free':  'bg-yellow-100 text-yellow-700',
  'Nut-Free':     'bg-orange-100 text-orange-700',
  'Dairy-Free':   'bg-blue-100 text-blue-700',
  'Halal':        'bg-teal-100 text-teal-700',
  'Kosher':       'bg-purple-100 text-purple-700',
}

export default function SlotCard({ slotNumber, noun, itemNoun, dishName, signup, onClick }) {
  const filled = Boolean(signup)

  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden text-left w-full p-4 rounded-xl border-2 shadow-sm transition-all duration-150 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${
        filled
          ? 'bg-lagoon-50 border-lagoon-200 hover:border-lagoon'
          : 'bg-sunrise-50 border-stone-200 hover:border-jade'
      }`}
    >
      {filled && <span className="absolute left-0 top-0 h-full w-1 bg-jade" />}
      {dishName ? (
        <div className="font-semibold text-stone-800 truncate mb-1">{dishName}</div>
      ) : (
        <div className="text-sm text-stone-400 italic mb-1">No {itemNoun.toLowerCase()} set</div>
      )}

      {filled ? (
        <>
          <div className="text-sm text-jade font-medium truncate">→ {signup.name}</div>
          {signup.dietary_tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {signup.dietary_tags.map(tag => (
                <span
                  key={tag}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_STYLES[tag] ?? 'bg-stone-100 text-stone-600'}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {signup.notes && (
            <div className="text-xs text-stone-400 mt-1.5 line-clamp-1 italic">{signup.notes}</div>
          )}
        </>
      ) : (
        <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-jade/40 text-jade bg-white group-hover:bg-jade group-hover:text-white group-hover:border-jade transition-all">
          + Sign up
        </span>
      )}
    </button>
  )
}
