export const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 Bytes";

  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return (
    parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) +
    " " +
    sizes[i]
  );
};

export const formatHours = (hours = 0) => {
  return Number(hours).toFixed(2) + " hrs";
};

export const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const truncate = (text = "", length = 50) => {
  if (text.length <= length) {
    return text;
  }

  return text.substring(0, length) + "...";
};