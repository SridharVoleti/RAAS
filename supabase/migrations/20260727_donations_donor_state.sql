-- Records the donor's self-declared state/location and FCRA declaration acceptance
-- at time of donation, as evidence that the Trust only accepted eligible
-- Indian-domestic contributions from donors who affirmed the compliance declaration.
ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor_state text;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS declaration_accepted boolean NOT NULL DEFAULT false;
