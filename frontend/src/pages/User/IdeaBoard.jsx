import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { ThumbsUp, MessageSquarePlus, MessageSquare, AlertCircle } from 'lucide-react';

const IdeaBoard = () => {
  const [ideas, setIdeas] = useState([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchIdeas = async () => {
    try {
      const res = await api.get('/users/ideas');
      setIdeas(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/users/ideas', { title, description: desc });
      setTitle('');
      setDesc('');
      setSuccess('Idea submitted successfully!');
      fetchIdeas();
    } catch (err) {
      setError('Failed to submit idea. Please try again.');
    }
  };

  const handleUpvote = async (ideaId) => {
    try {
      const res = await api.post(`/users/ideas/${ideaId}/upvote`);
      setIdeas(ideas.map(idea => 
        idea.id === ideaId 
          ? { ...idea, upvotes: res.data.upvotes, is_upvoted: res.data.is_upvoted } 
          : idea
      ));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Suggestions List */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="font-headline font-bold text-2xl text-on-surface">iTech Suggestion Board</h1>
          <p className="text-secondary text-sm">Upvote menu items or features you'd like to see implemented.</p>
        </div>

        <div className="space-y-4">
          {ideas.map(idea => (
            <div key={idea.id} className="bg-surface-container-lowest border border-outline/10 p-5 rounded-2xl flex items-start justify-between gap-6 transition-all hover:shadow-md">
              <div className="space-y-2">
                <h3 className="font-headline font-bold text-base text-on-surface">{idea.title}</h3>
                <p className="text-secondary text-xs leading-relaxed">{idea.description}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-outline uppercase font-bold tracking-wider">
                  <MessageSquare size={12} />
                  Canteen Board Suggestion
                </div>
              </div>

              <button
                onClick={() => handleUpvote(idea.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                  idea.is_upvoted
                    ? 'bg-primary/5 border-primary text-primary'
                    : 'border-outline/20 hover:bg-surface-container-high text-secondary'
                }`}
              >
                <ThumbsUp size={16} className={idea.is_upvoted ? 'fill-primary' : ''} />
                <span className="text-xs font-black">{idea.upvotes}</span>
              </button>
            </div>
          ))}

          {ideas.length === 0 && (
            <p className="text-center py-12 text-outline text-sm">No suggestions yet. Be the first to add one!</p>
          )}
        </div>
      </div>

      {/* Idea Form */}
      <div>
        <div className="bg-surface-container-low border border-outline/10 p-6 rounded-2xl space-y-4 sticky top-[80px]">
          <h3 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
            <MessageSquarePlus className="text-primary" size={20} />
            Suggest a Feature
          </h3>
          <p className="text-secondary text-xs">Want new milkshakes, desserts, or payment options? Voice your ideas.</p>
          
          {error && (
            <div className="flex items-start gap-2 p-3 bg-error-container/20 border border-error/10 rounded-xl text-error text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Title</label>
              <input
                type="text"
                placeholder="e.g. Add Cold Brew Coffee"
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline/20 rounded-xl text-xs focus:ring-1 focus:ring-primary/20"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-outline uppercase tracking-wider">Description</label>
              <textarea
                placeholder="Describe your idea or menu request..."
                rows={4}
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline/20 rounded-xl text-xs focus:ring-1 focus:ring-primary/20"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-on-primary-fixed-variant transition-colors text-xs"
            >
              Submit Idea
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};

export default IdeaBoard;
