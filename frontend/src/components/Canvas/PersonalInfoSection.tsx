import { Input } from '../Common/Input';
import type { PersonalInfo } from '../../types/cvDraft';

type Props = { value: PersonalInfo; onChange: (v: PersonalInfo) => void };

export function PersonalInfoSection({ value, onChange }: Props) {
  const set = (k: keyof PersonalInfo) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div>
      <Input label="Full Name" autoComplete="name" value={value.name} onChange={set('name')} placeholder="John Doe" />
      <Input label="Headline" value={value.headline} onChange={set('headline')} placeholder="Senior Data Analyst" />
      <Input label="Email" type="email" autoComplete="email" value={value.email} onChange={set('email')} placeholder="john@example.com" />
      <Input label="Phone" type="tel" autoComplete="tel" value={value.phone} onChange={set('phone')} placeholder="+1 (555) 123-4567" />
      <Input label="Location" autoComplete="address-level2" value={value.location} onChange={set('location')} placeholder="San Francisco, CA" />
      <Input label="LinkedIn URL" type="url" value={value.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/johndoe" />
      <Input label="Portfolio URL" type="url" value={value.portfolio} onChange={set('portfolio')} placeholder="https://johndoe.com" />
    </div>
  );
}
