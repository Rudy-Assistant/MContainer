export type SliceSet<TState> = (
  partial: Partial<TState> | ((state: TState) => Partial<TState> | void)
) => void;

export type SliceGet<TState> = () => TState;
