interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, disabled = false }) => {
  return (
    <div className="flex items-center justify-between gap-2.5 my-1.5">
      <span>{label}</span>
      <label className="relative inline-block w-[50px] h-6">
        <input 
          type="checkbox" 
          className="opacity-0 w-0 h-0"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <span className={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${checked ? 'bg-level4' : 'bg-level2'} before:absolute before:content-[''] before:h-4 before:w-4 before:left-1 before:bottom-1 before:bg-level6 before:rounded-full before:transition-all ${checked ? 'before:translate-x-[26px]' : ''}`}></span>
      </label>
    </div>
  );
};

export default Toggle; 