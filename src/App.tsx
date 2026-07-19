import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Loader2, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  RefreshCw, 
  Bookmark, 
  Trash2, 
  Library, 
  Plus, 
  Search, 
  Download, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Filter, 
  ChevronRight,
  Info
} from 'lucide-react';

interface ClueItem {
  category: string;
  clue: string;
  answer: string;
  difficulty: string;
  hint: string;
}

interface LibraryItem extends ClueItem {
  id: string;
  createdAt: number;
}

// Robust CSV parser to handle wrapped fields and embedded quotes/commas
function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const cleanValue = (val: string) => {
  return val.replace(/^"|"$/g, '').trim();
};

export default function App() {
  // Generator form states
  const [category, setCategory] = useState('');
  const [count, setCount] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ClueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Library & UI states
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryMessage, setLibraryMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  
  // Library filters
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [exportCategory, setExportCategory] = useState<string>('All');

  // Unique categories in the library
  const uniqueCategories = Array.from(new Set(library.map(item => item.category))).filter(Boolean).sort();
  
  // Manual form states
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCategory, setManualCategory] = useState('');
  const [manualClue, setManualClue] = useState('');
  const [manualAnswer, setManualAnswer] = useState('');
  const [manualDifficulty, setManualDifficulty] = useState('Medium');
  const [manualHint, setManualHint] = useState('');

  // Interactive Hint / Reveal States for generated results
  const [revealedHints, setRevealedHints] = useState<{ [key: number]: boolean }>({});
  // Reveal states for library items
  const [revealedLibHints, setRevealedLibHints] = useState<{ [key: string]: boolean }>({});

  // Load library from local storage on mount
  useEffect(() => {
    const savedLibrary = localStorage.getItem('crossword_library_v2');
    if (savedLibrary) {
      try {
        setLibrary(JSON.parse(savedLibrary));
      } catch (e) {
        console.error('Failed to parse library', e);
      }
    } else {
      // Seed with some beautiful default examples if library is empty
      const defaultSeeds: LibraryItem[] = [
        {
          id: 'seed-1',
          category: 'Space',
          clue: 'The fifth planet from the Sun and largest in the solar system',
          answer: 'JUPITER',
          difficulty: 'Easy',
          hint: 'Named after the king of ancient Roman gods',
          createdAt: Date.now() - 500000
        },
        {
          id: 'seed-2',
          category: 'Literature',
          clue: 'The protagonist of Moby-Dick who tells the story',
          answer: 'ISHMAEL',
          difficulty: 'Hard',
          hint: '"Call me ___"',
          createdAt: Date.now() - 400000
        },
        {
          id: 'seed-3',
          category: 'General Science',
          clue: 'Noble gas with atomic number 2, commonly used in balloons',
          answer: 'HELIUM',
          difficulty: 'Easy',
          hint: 'Second lightest chemical element',
          createdAt: Date.now() - 300000
        }
      ];
      setLibrary(defaultSeeds);
    }
  }, []);

  // Save library to local storage when changed
  useEffect(() => {
    localStorage.setItem('crossword_library_v2', JSON.stringify(library));
  }, [library]);

  const generateClues = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!category.trim()) {
      setError('Please enter a category or topic.');
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);
    setResults([]);
    setRevealedHints({});

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Generate exactly ${count} diverse and clever crossword puzzle word and clue sets for the category/theme: '${category}'. 
The output MUST be strictly in standard comma-separated (CSV) format without headers.
Format per line: Answer,Clue

Example format:
"MARS","The fourth planet from the Sun"
"OPERATINGSYSTEM","The core software of a computer"

Rules:
1. Ensure there are exactly ${count} rows of output.
2. Each line must contain exactly 2 comma-separated values (Answer, Clue).
3. Wrap both fields in double quotes to gracefully handle commas inside clues.
4. The 'Answer' must be a single uppercase word with no spaces or punctuation.
5. Do not include markdown formatting, backticks, titles, list numbering, or conversational introduction. Just output raw lines.`,
      });

      if (response.text) {
        const rawLines = response.text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        const parsed: ClueItem[] = [];
        
        for (const line of rawLines) {
          // Attempt standard quote-aware parsing
          const parts = parseCSVLine(line);
          if (parts.length >= 2) {
            parsed.push({
              category: category || 'General',
              clue: cleanValue(parts[1]) || 'No clue provided',
              answer: cleanValue(parts[0]).toUpperCase().replace(/[^A-Z]/g, '') || 'ANSWER',
              difficulty: 'Medium',
              hint: ''
            });
          } else {
            // Fallback for simple comma separation if quotes were omitted
            const simpleParts = line.split(',');
            if (simpleParts.length >= 2) {
              parsed.push({
                category: category || 'General',
                clue: cleanValue(simpleParts[1]) || 'No clue provided',
                answer: cleanValue(simpleParts[0]).toUpperCase().replace(/[^A-Z]/g, '') || 'ANSWER',
                difficulty: 'Medium',
                hint: ''
              });
            }
          }
        }

        if (parsed.length === 0) {
          setError('Failed to parse response format. Please try generating again.');
        } else {
          setResults(parsed);
        }
      } else {
        setError('Received empty response from the AI model.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating crossword clues.');
    } finally {
      setLoading(false);
    }
  };

  // Save single item to the library with duplicate check
  const saveToLibrary = (item: ClueItem) => {
    // Check duplicate: case-insensitive match on both answer & clue
    const isDuplicate = library.some(
      libItem => 
        libItem.answer.toLowerCase() === item.answer.toLowerCase() && 
        libItem.clue.toLowerCase() === item.clue.toLowerCase()
    );

    if (isDuplicate) {
      setLibraryMessage({ 
        text: `"${item.answer}" with this clue is already in your library.`, 
        type: 'info' 
      });
      setTimeout(() => setLibraryMessage(null), 3500);
      return false;
    }

    const newItem: LibraryItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: Date.now()
    };

    setLibrary(prev => [newItem, ...prev]);
    setLibraryMessage({ 
      text: `Saved "${item.answer}" successfully!`, 
      type: 'success' 
    });
    setTimeout(() => setLibraryMessage(null), 3000);
    return true;
  };

  // Save all current generated results to library, skipping duplicates automatically
  const saveAllToLibrary = () => {
    let savedCount = 0;
    let skippedCount = 0;
    const newItemsToAdd: LibraryItem[] = [];

    results.forEach(resItem => {
      // Check duplicate in already saved library
      const inLibrary = library.some(
        libItem => 
          libItem.answer.toLowerCase() === resItem.answer.toLowerCase() && 
          libItem.clue.toLowerCase() === resItem.clue.toLowerCase()
      );

      // Check duplicate within the incoming batch itself to prevent batch self-duplication
      const inBatch = newItemsToAdd.some(
        addedItem => 
          addedItem.answer.toLowerCase() === resItem.answer.toLowerCase() && 
          addedItem.clue.toLowerCase() === resItem.clue.toLowerCase()
      );

      if (!inLibrary && !inBatch) {
        newItemsToAdd.push({
          ...resItem,
          id: Math.random().toString(36).substring(2, 9),
          createdAt: Date.now()
        });
        savedCount++;
      } else {
        skippedCount++;
      }
    });

    if (newItemsToAdd.length > 0) {
      setLibrary(prev => [...newItemsToAdd, ...prev]);
    }

    if (savedCount > 0) {
      setLibraryMessage({
        text: `Successfully added ${savedCount} item(s) to your Library.${skippedCount > 0 ? ` (${skippedCount} duplicate pairs skipped)` : ''}`,
        type: 'success'
      });
    } else {
      setLibraryMessage({
        text: `All generated pairs are already saved in your Library.`,
        type: 'info'
      });
    }

    setTimeout(() => setLibraryMessage(null), 4000);
  };

  const addManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAnswer.trim() || !manualClue.trim()) {
      setLibraryMessage({ text: 'Answer and Clue are required.', type: 'error' });
      return;
    }

    const cleanedAnswer = manualAnswer.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const finalCategory = manualCategory.trim() || 'General';

    const isDuplicate = library.some(
      libItem => 
        libItem.answer.toLowerCase() === cleanedAnswer.toLowerCase() && 
        libItem.clue.toLowerCase() === manualClue.trim().toLowerCase()
    );

    if (isDuplicate) {
      setLibraryMessage({ text: `Duplicate alert: "${cleanedAnswer}" with this clue already exists.`, type: 'error' });
      return;
    }

    const manualItem: LibraryItem = {
      id: Math.random().toString(36).substring(2, 9),
      category: finalCategory,
      clue: manualClue.trim(),
      answer: cleanedAnswer,
      difficulty: manualDifficulty,
      hint: manualHint.trim() || 'No hint provided',
      createdAt: Date.now()
    };

    setLibrary(prev => [manualItem, ...prev]);
    setLibraryMessage({ text: `Manually added "${cleanedAnswer}" to library!`, type: 'success' });
    
    // Reset manual form fields
    setManualCategory('');
    setManualClue('');
    setManualAnswer('');
    setManualDifficulty('Medium');
    setManualHint('');
    setShowManualForm(false);

    setTimeout(() => setLibraryMessage(null), 3000);
  };

  const removeFromLibrary = (id: string) => {
    const itemToRemove = library.find(item => item.id === id);
    setLibrary(prev => prev.filter(item => item.id !== id));
    if (itemToRemove) {
      setLibraryMessage({ text: `Removed "${itemToRemove.answer}" from library.`, type: 'info' });
      setTimeout(() => setLibraryMessage(null), 3000);
    }
  };

  // Copy standard representation
  const copyToClipboard = () => {
    const textToCopy = results.map(item => `"${item.answer}","${item.clue}"`).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Export full Library or selected category to standard CSV format
  const exportLibraryToCSV = () => {
    const itemsToExport = exportCategory === 'All'
      ? library
      : library.filter(item => item.category === exportCategory);

    if (itemsToExport.length === 0) {
      setLibraryMessage({ text: `No items in category "${exportCategory}" to export.`, type: 'error' });
      setTimeout(() => setLibraryMessage(null), 3000);
      return;
    }
    
    const headers = 'Category,Clue,Answer,Difficulty,Hint\n';
    const rows = itemsToExport.map(item => 
      `"${item.category.replace(/"/g, '""')}","${item.clue.replace(/"/g, '""')}","${item.answer.replace(/"/g, '""')}","${item.difficulty}","${item.hint.replace(/"/g, '""')}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const suffix = exportCategory === 'All' ? 'all' : exportCategory.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `crossword_pairs_${suffix}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setLibraryMessage({ 
      text: `Exported ${itemsToExport.length} pair(s) from "${exportCategory}" category!`, 
      type: 'success' 
    });
    setTimeout(() => setLibraryMessage(null), 3000);
  };

  // Toggle reveal state for generated hints
  const toggleHintReveal = (index: number) => {
    setRevealedHints(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Toggle reveal state for library hints
  const toggleLibHintReveal = (id: string) => {
    setRevealedLibHints(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filtered Library Items
  const filteredLibrary = library.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      item.answer.toLowerCase().includes(query) ||
      item.clue.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.hint.toLowerCase().includes(query);
    
    const matchesDifficulty = difficultyFilter === 'All' || item.difficulty === difficultyFilter;
    
    return matchesSearch && matchesDifficulty;
  });

  // Get difficulty badge color classes
  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'hard':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'medium':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-slate-900 flex items-center gap-2">
              🧩 ClueSmith
            </h1>
            <p className="text-slate-500 text-sm sm:text-base">
              Generate, refine, and organize crossword puzzle clue pairs in standard constructor format.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 w-fit self-start sm:self-center">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Format: Answer, Clue
          </div>
        </header>

        {/* Generator Controls */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
          <form onSubmit={generateClues} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-2 space-y-2">
                <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Choose Category or Theme
                </label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Ancient Egypt, Classic Rock, Computer Science, Kitchen Utensils..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="count" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Number of Pairs
                </label>
                <input
                  id="count"
                  type="number"
                  min="1"
                  max="30"
                  value={count}
                  onChange={(e) => setCount(Math.min(30, Math.max(1, parseInt(e.target.value) || 10)))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none text-slate-800 bg-slate-50 focus:bg-white"
                  disabled={loading}
                />
              </div>

            </div>

            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div>
                  <span className="font-semibold">Generation Error:</span> {error}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !category.trim()}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating from AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Generate Pairs
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results Presentation Area */}
        {results.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            
            {/* Results Title bar */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Generated Crossword Pairs
                  <span className="bg-indigo-50 text-indigo-700 py-0.5 px-2.5 rounded-full text-xs font-semibold border border-indigo-100">
                    {results.length} Available
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">Format: Answer, Clue</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={saveAllToLibrary}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100/70 transition-colors"
                >
                  <Bookmark className="w-4 h-4" />
                  Save All to Library
                </button>
                <button
                  onClick={() => generateClues()}
                  disabled={loading}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white"
                  title="Regenerate with same options"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy CSV Rows
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* List of Results */}
            <div className="divide-y divide-slate-100">
              {results.map((item, index) => (
                <div key={index} className="p-4 sm:p-6 hover:bg-slate-50/40 transition-colors group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-3 sm:space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {item.category}
                      </span>
                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${getDifficultyBadge(item.difficulty)}`}>
                        {item.difficulty}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                      <div className="font-mono font-bold text-indigo-600 text-lg uppercase tracking-wider min-w-[140px] shrink-0">
                        {item.answer}
                      </div>
                      <div className="text-slate-700 font-medium text-base">
                        {item.clue}
                      </div>
                    </div>

                    {/* Hint section */}
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <button 
                        onClick={() => toggleHintReveal(index)}
                        className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors"
                      >
                        {revealedHints[index] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {revealedHints[index] ? 'Hide Hint' : 'View Hint'}
                      </button>
                      {revealedHints[index] && (
                        <span className="text-indigo-500 italic font-medium bg-indigo-50/50 px-2.5 py-0.5 rounded border border-indigo-100/50 animate-fade-in">
                          💡 Hint: {item.hint}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => saveToLibrary(item)}
                    className="sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-center flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg border border-slate-200 hover:border-indigo-100"
                    title="Save to Library"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* Saved Word Library Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Library className="w-6 h-6 text-indigo-500" />
              My Word Library
              <span className="text-xs font-mono font-normal bg-slate-200/60 text-slate-600 px-2.5 py-0.5 rounded-full ml-1">
                {library.length} items
              </span>
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Clue Manually
              </button>

              {library.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-xl bg-white px-3 py-1.5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Filter className="w-3 h-3 text-slate-400" />
                    Export Category:
                  </span>
                  <select
                    value={exportCategory}
                    onChange={(e) => setExportCategory(e.target.value)}
                    className="text-sm font-semibold text-indigo-600 bg-transparent outline-none cursor-pointer hover:text-indigo-800 transition-colors"
                  >
                    <option value="All">All Categories</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>
                  <button
                    onClick={exportLibraryToCSV}
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-all cursor-pointer"
                    title="Download CSV for Selected Category"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>Export to CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Library Actions Status Messages */}
          {libraryMessage && (
            <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 transition-all ${
              libraryMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 animate-pulse' :
              libraryMessage.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-100' :
              'bg-indigo-50 text-indigo-700 border-indigo-100'
            }`}>
              {libraryMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
              {libraryMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
              <span className="font-medium">{libraryMessage.text}</span>
            </div>
          )}

          {/* Manual Entry Form */}
          {showManualForm && (
            <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-6 sm:p-8 animate-fade-in">
              <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
                ✏️ Manually Add Crossword Clue
              </h3>
              <form onSubmit={addManualItem} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-slate-500">Answer (Uppercase)</label>
                    <input
                      type="text"
                      value={manualAnswer}
                      onChange={(e) => setManualAnswer(e.target.value)}
                      placeholder="e.g. JUPITER"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none font-mono uppercase"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-slate-500">Category</label>
                    <input
                      type="text"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      placeholder="e.g. Space"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-slate-500">Difficulty</label>
                    <select
                      value={manualDifficulty}
                      onChange={(e) => setManualDifficulty(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold uppercase text-slate-500">Hint (Optional)</label>
                    <input
                      type="text"
                      value={manualHint}
                      onChange={(e) => setManualHint(e.target.value)}
                      placeholder="e.g. Roman god"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase text-slate-500">The Clue</label>
                  <input
                    type="text"
                    value={manualClue}
                    onChange={(e) => setManualClue(e.target.value)}
                    placeholder="e.g. The fifth planet from the Sun"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all"
                  >
                    Add to Library
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Library Content Table */}
          {library.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-2">
              <Library className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-400 font-medium">Your library is currently empty.</p>
              <p className="text-xs text-slate-400">Generate some clever puzzle pairs or add some manually to build your constructor inventory.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              
              {/* Library search filters and stats */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-72">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search keywords, answers, clues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                  <span className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    Filter Difficulty:
                  </span>
                  <div className="flex gap-1.5">
                    {['All', 'Easy', 'Medium', 'Hard'].map(dif => (
                      <button
                        key={dif}
                        onClick={() => setDifficultyFilter(dif)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                          difficultyFilter === dif 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {dif}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table Body */}
              <div className="max-h-[550px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Answer</th>
                      <th className="px-6 py-4 font-semibold">Clue</th>
                      <th className="px-6 py-4 font-semibold hidden sm:table-cell">Category</th>
                      <th className="px-6 py-4 font-semibold hidden md:table-cell">Hint</th>
                      <th className="px-6 py-4 font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLibrary.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                          No saved pairs match your active search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredLibrary.map((item) => (
                        <tr key={item.id} className="group hover:bg-indigo-50/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono font-bold text-indigo-700 uppercase text-base tracking-wider">
                                {item.answer}
                              </span>
                              <span className={`text-[10px] w-fit font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${getDifficultyBadge(item.difficulty)}`}>
                                {item.difficulty}
                              </span>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 text-slate-700 text-sm font-medium">
                            {item.clue}
                          </td>
                          
                          <td className="px-6 py-4 text-slate-400 text-xs font-mono hidden sm:table-cell">
                            {item.category}
                          </td>
                          
                          <td className="px-6 py-4 text-slate-500 text-xs hidden md:table-cell max-w-[200px] truncate">
                            <div className="space-y-1">
                              <button
                                onClick={() => toggleLibHintReveal(item.id)}
                                className="text-slate-400 hover:text-indigo-600 font-semibold flex items-center gap-1 transition-colors"
                              >
                                {revealedLibHints[item.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {revealedLibHints[item.id] ? 'Hide Hint' : 'Show Hint'}
                              </button>
                              {revealedLibHints[item.id] && (
                                <p className="italic text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100/50 break-words">
                                  {item.hint}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => removeFromLibrary(item.id)}
                              className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                              title="Delete Clue"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                <span>
                  Showing {filteredLibrary.length} of {library.length} saved pairs. Stored securely in local browser storage.
                </span>
                {library.length > 0 && (
                  <button
                    onClick={() => {
                      const itemsToCopy = exportCategory === 'All'
                        ? library
                        : library.filter(item => item.category === exportCategory);
                      const text = itemsToCopy.map(item => `"${item.category}","${item.clue}","${item.answer}","${item.difficulty}","${item.hint}"`).join('\n');
                      navigator.clipboard.writeText(text);
                      setLibraryMessage({ 
                        text: exportCategory === 'All' 
                          ? 'Full Word Library copied to clipboard in CSV format!' 
                          : `Word Library for category "${exportCategory}" copied to clipboard in CSV format!`, 
                        type: 'success' 
                      });
                      setTimeout(() => setLibraryMessage(null), 3000);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {exportCategory === 'All' ? 'Copy All Library to Clipboard (CSV)' : `Copy Category "${exportCategory}" to Clipboard (CSV)`}
                  </button>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
