import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Heart, MessageCircle, Target, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  content: string;
  icon: typeof Heart;
}

const articles: Article[] = [
  {
    id: "1",
    title: "Not Every Match Defines Your Worth",
    slug: "handling-rejection",
    category: "Navigating Connections",
    icon: Heart,
    content: `Rejection is part of the journey. When someone doesn't respond or chooses not to continue, it's natural to feel disappointed.

**What helps:**
- Remember: one person's choice isn't a judgment of your value
- Focus on what you can control: your behaviour, your intentions, your dignity
- Give yourself time to process, then continue with patience

Rejection teaches us what we're looking for. Each "no" brings you closer to the right "yes."

**Practical steps:**
- Don't take it personally—compatibility is complex
- Avoid dwelling or creating negative stories
- Stay open to new connections
- Treat others the way you'd want to be treated`,
  },
  {
    id: "2",
    title: "Meaningful Connections Take Time",
    slug: "managing-expectations",
    category: "Navigating Connections",
    icon: Heart,
    content: `It's natural to hope for quick results. But rushing rarely leads to the right outcome.

**What helps:**
- Approach each conversation with openness, not urgency
- Look for consistency over chemistry alone
- Be patient with yourself and others
- Focus on the journey, not just the destination

The best matches often develop gradually. Trust the process.

**Practical steps:**
- Don't expect instant perfection
- Give people time to show their character
- Notice patterns, not just first impressions
- Stay grounded in your values`,
  },
  {
    id: "3",
    title: "Respecting Yourself & Others",
    slug: "healthy-boundaries",
    category: "Healthy Communication",
    icon: MessageCircle,
    content: `Boundaries protect everyone in the interaction. They're not walls—they're guidelines for respectful connection.

**What this looks like:**
- Saying no when something doesn't feel right
- Not over-investing before you truly know someone
- Communicating your values and expectations clearly
- Respecting when others do the same

Healthy boundaries make better matches possible.

**Practical steps:**
- Be clear about your pace and comfort level
- Don't compromise on core values
- Speak up if something feels off
- Honor other people's boundaries too`,
  },
  {
    id: "4",
    title: "Be Honest About What You're Seeking",
    slug: "clear-intentions",
    category: "Focus & Intention",
    icon: Target,
    content: `Unclear intentions waste time and cause emotional confusion.

**What helps:**
- Know what you're looking for (marriage, timeline, priorities)
- Communicate this early, respectfully
- Don't lead people on if you're unsure
- It's okay to still be figuring things out—just say so

Honesty protects everyone's time and heart.

**Practical steps:**
- Be upfront about your marriage timeline
- Share your priorities early in conversations
- If your feelings change, communicate that
- Respect others who do the same`,
  },
  {
    id: "5",
    title: "Focus on What You Can Control",
    slug: "focus-on-control",
    category: "Focus & Intention",
    icon: Target,
    content: `**You cannot control:**
- Whether someone responds
- How quickly things progress
- Other people's choices or timing

**You can control:**
- How you present yourself
- The respect you show
- Your emotional reactions
- The effort you put in

Focus your energy on what's yours to manage. The rest will follow naturally.

**Practical steps:**
- Let go of outcomes you can't influence
- Put energy into being your authentic self
- Respond with dignity, not reaction
- Stay consistent in your values`,
  },
  {
    id: "6",
    title: "Staying Emotionally Grounded",
    slug: "emotional-balance",
    category: "Navigating Connections",
    icon: Heart,
    content: `The search for a partner can be emotionally intense. Staying balanced protects your wellbeing and makes you a better potential match.

**What helps:**
- Don't make this your entire life
- Maintain other relationships and interests
- Take breaks when you need them
- Process disappointment, don't ignore it

You'll make better decisions when you're emotionally balanced.

**Practical steps:**
- Set time limits on the app
- Talk to trusted friends or family
- Engage in activities that ground you
- Remember: finding a partner is important, not urgent`,
  },
  {
    id: "7",
    title: "Communication That Honors Others",
    slug: "respectful-communication",
    category: "Healthy Communication",
    icon: MessageCircle,
    content: `How you communicate matters as much as what you communicate.

**Good communication:**
- Is honest but kind
- Considers the other person's perspective
- Addresses concerns directly, not passive-aggressively
- Gives people space to respond in their own time

**Poor communication:**
- Is dismissive or harsh
- Makes assumptions
- Ghosts without explanation
- Pressures for immediate responses

Treat others the way you'd want to be treated.

**Practical steps:**
- If you're not interested, say so politely
- If you need time, communicate that
- Don't leave people guessing
- Be direct but compassionate`,
  },
  {
    id: "8",
    title: "The Value of Patience",
    slug: "patience-in-process",
    category: "Focus & Intention",
    icon: Target,
    content: `Finding the right person takes time. Impatience can lead to poor decisions and unnecessary frustration.

**What patience looks like:**
- Giving conversations room to develop
- Not forcing outcomes
- Accepting that timing matters
- Staying hopeful without being desperate

Patience isn't passive—it's active trust in the process.

**Practical steps:**
- Don't rush physical or emotional milestones
- Allow people to reveal themselves naturally
- Practice gratitude for the journey
- Trust in Allah's timing`,
  },
];

const categories = [
  { name: "All", icon: BookOpen },
  { name: "Navigating Connections", icon: Heart },
  { name: "Healthy Communication", icon: MessageCircle },
  { name: "Focus & Intention", icon: Target },
];

export default function GuidanceHub() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filteredArticles = selectedCategory === "All"
    ? articles
    : articles.filter((a) => a.category === selectedCategory);

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background border-b p-4">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedArticle(null)}
              data-testid="button-back-to-articles"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <Badge variant="secondary">{selectedArticle.category}</Badge>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6">
          <article className="space-y-6">
            <h1 className="text-2xl font-bold">{selectedArticle.title}</h1>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {selectedArticle.content.split("\n\n").map((paragraph, idx) => {
                if (paragraph.startsWith("**") && paragraph.endsWith("**")) {
                  return (
                    <h3 key={idx} className="font-semibold text-lg mt-6 mb-2">
                      {paragraph.replace(/\*\*/g, "")}
                    </h3>
                  );
                }
                if (paragraph.startsWith("**")) {
                  const [title, ...rest] = paragraph.split("\n");
                  return (
                    <div key={idx} className="my-4">
                      <h3 className="font-semibold mb-2">
                        {title.replace(/\*\*/g, "")}
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        {rest.map((line, i) => (
                          <li key={i} className="text-muted-foreground">
                            {line.replace(/^- /, "")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                if (paragraph.startsWith("-")) {
                  return (
                    <ul key={idx} className="list-disc list-inside space-y-1 my-4">
                      {paragraph.split("\n").map((line, i) => (
                        <li key={i} className="text-muted-foreground">
                          {line.replace(/^- /, "")}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={idx} className="text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/settings")}
            data-testid="button-back-to-settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold">Guidance Hub</h1>
            <p className="text-xs text-muted-foreground">
              Emotional support and advice
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <Button
              key={cat.name}
              variant={selectedCategory === cat.name ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.name)}
              className="shrink-0"
              data-testid={`button-category-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <cat.icon className="h-4 w-4 mr-1" />
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredArticles.map((article) => (
            <Card
              key={article.id}
              className="cursor-pointer hover-elevate transition-all"
              onClick={() => setSelectedArticle(article)}
              data-testid={`card-article-${article.slug}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {article.category}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardTitle className="text-base leading-tight">
                  {article.title}
                </CardTitle>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No articles in this category yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
