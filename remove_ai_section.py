import sys

file_path = "/Users/leejeonghan/Downloads/KoreanVoteGuide2/client/src/pages/member-detail.tsx"
with open(file_path, "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if line.startswith('import { useAssemblyMembers, useMemberDetail, useMemberAlumni, useLegislatorAnalysis }'):
        new_lines.append(line.replace(', useLegislatorAnalysis', ''))
        continue
    
    if 'const { analysis, isLoading: isAnalysisLoading } = useLegislatorAnalysis(id);' in line:
        continue

    if "{/* ===== AI 의원 성향 분석 섹션 ===== */}" in line:
        skip = True
    
    if skip:
        if "{/* ===== AI \"이유있는 점수\"" in line:
            skip = False
            # We want to add an empty line before this section since we skipped the original empty line
            new_lines.append("\n")
            new_lines.append(line)
        continue
        
    new_lines.append(line)

with open(file_path, "w") as f:
    f.writelines(new_lines)

