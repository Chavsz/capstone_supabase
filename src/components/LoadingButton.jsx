import React from "react";

const LoadingButton = ({
  isLoading = false,
  loadingText = "Loading...",
  disabled = false,
  className = "",
  children,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={className}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span>{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton;
