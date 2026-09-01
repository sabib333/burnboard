export async function deleteMyData() {
  try {
    if (typeof window === 'undefined') return { success: true };
    const anonId = localStorage.getItem('burnboard_anon_id');

    const keysToRemove = [
      'burnboard_anon_id',
      'burnboard_last_roast_timestamp',
      'burnboard_recent_roasts_cache',
      'burnboard_user_roast_count',
      'burnboard_notification_subs',
      'burnboard_voted_battles',
      'burnboard_upvoted_roasts',
      'burnboard_reacted_roasts'
    ];

    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    return {
      success: true,
      message: 'All your local footprint and votes have been purged.'
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || 'Failed to delete data.'
    };
  }
}
