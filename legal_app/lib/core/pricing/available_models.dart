enum AiModelTier { auto, premium }

class AiModel {
  const AiModel({
    required this.id,
    required this.name,
    required this.description,
    required this.tier,
  });

  final String id;
  final String name;
  final String description;
  final AiModelTier tier;
}

/// Marketing list for subscription screens — live picker uses backend `availablePremiumModels`.
const List<AiModel> kAvailableModels = [
  AiModel(
    id: 'auto',
    name: 'Auto',
    description: 'Best model picked for each task',
    tier: AiModelTier.auto,
  ),
  AiModel(
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    description: 'Fast & efficient for everyday tasks',
    tier: AiModelTier.auto,
  ),
  AiModel(
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    description: 'OpenAI flagship — deep legal reasoning',
    tier: AiModelTier.premium,
  ),
  AiModel(
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    description: 'Premium GPT for substantive drafting',
    tier: AiModelTier.premium,
  ),
  AiModel(
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'Balanced GPT for research and analysis',
    tier: AiModelTier.premium,
  ),
];

const kAutoModels = [
  AiModel(
    id: 'auto',
    name: 'Auto',
    description: 'Best model picked for each task',
    tier: AiModelTier.auto,
  ),
  AiModel(
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    description: 'Fast & efficient for everyday tasks',
    tier: AiModelTier.auto,
  ),
];

const kPremiumModels = [
  AiModel(
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    description: 'OpenAI flagship — deep legal reasoning',
    tier: AiModelTier.premium,
  ),
  AiModel(
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    description: 'Premium GPT for substantive drafting',
    tier: AiModelTier.premium,
  ),
  AiModel(
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'Balanced GPT for research and analysis',
    tier: AiModelTier.premium,
  ),
];
