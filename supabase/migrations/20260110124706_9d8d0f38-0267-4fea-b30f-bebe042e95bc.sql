-- Create trigger to automatically match aliases when new docket entries are inserted
CREATE TRIGGER auto_match_on_insert
  AFTER INSERT ON public.daily_court_docket
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_match_aliases();

-- Also trigger on updates where lawyer fields change  
CREATE TRIGGER auto_match_on_update
  AFTER UPDATE OF petitioner_lawyer, respondent_lawyer ON public.daily_court_docket
  FOR EACH ROW
  WHEN (
    (OLD.petitioner_lawyer IS DISTINCT FROM NEW.petitioner_lawyer OR 
     OLD.respondent_lawyer IS DISTINCT FROM NEW.respondent_lawyer)
    AND NEW.matched_profile_id IS NULL
  )
  EXECUTE FUNCTION public.trigger_auto_match_aliases();